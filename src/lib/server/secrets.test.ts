import { rmSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { allow } from './rateLimit';
import {
	FullaError,
	LIMITS,
	RETENTION_MS,
	createSecret,
	getSecret,
	hashToken,
	listSecrets,
	openLink,
	parseSecretInput,
	revealSecret,
	revokeSecret,
	sweep
} from './secrets';

const T0 = Date.parse('2026-11-13T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const ALICE = 'alice@example.com';

const IV = Buffer.alloc(12, 7).toString('base64');
const CIPHERTEXT = Buffer.from('not really encrypted, the server cannot tell').toString('base64');

function body(overrides: Record<string, unknown> = {}) {
	return {
		label: 'Router',
		ciphertext_b64: CIPHERTEXT,
		iv_b64: IV,
		expires_at: new Date(T0 + 24 * HOUR).toISOString(),
		recipients: [{ label: 'Anna', email: 'anna@example.com' }, { label: 'Bo' }],
		...overrides
	};
}

function create(db: Db, overrides: Record<string, unknown> = {}, creator = ALICE) {
	return createSecret(db, creator, parseSecretInput(body(overrides), T0), T0);
}

function status(err: unknown): number | undefined {
	return err instanceof FullaError ? err.status : undefined;
}

function failsWith(fn: () => unknown): number | undefined {
	try {
		fn();
	} catch (err) {
		return status(err);
	}
	return undefined;
}

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

describe('creating a secret', () => {
	it('hands back one token per recipient and stores only their hashes', () => {
		const created = create(db);
		expect(created.links.map((l) => l.label)).toEqual(['Anna', 'Bo']);
		const stored = db.prepare('SELECT token_hash FROM recipients').all() as { token_hash: string }[];
		expect(stored.map((r) => r.token_hash).sort()).toEqual(created.links.map((l) => hashToken(l.token)).sort());
		const dump = JSON.stringify(db.prepare('SELECT * FROM recipients').all());
		for (const { token } of created.links) expect(dump).not.toContain(token);
	});

	it('never returns a token again', () => {
		const created = create(db);
		const detail = JSON.stringify(getSecret(db, ALICE, created.id, T0));
		for (const { token } of created.links) expect(detail).not.toContain(token);
	});

	it.each([
		['no recipients', { recipients: [] }, 400],
		['too many recipients', { recipients: Array.from({ length: LIMITS.maxRecipients + 1 }, (_, i) => ({ label: `r${i}` })) }, 400],
		['a secret over the size cap', { ciphertext_b64: 'A'.repeat(LIMITS.maxCiphertextChars + 4) }, 413],
		['an IV that is not 12 bytes', { iv_b64: Buffer.alloc(16).toString('base64') }, 400],
		['ciphertext that is not base64', { ciphertext_b64: 'not base64!' }, 400],
		['an expiry more than 7 days out', { expires_at: new Date(T0 + 8 * 24 * HOUR).toISOString() }, 400],
		['an expiry in the past', { expires_at: new Date(T0 - HOUR).toISOString() }, 400],
		['a missing expiry', { expires_at: undefined }, 400],
		['a bad email address', { recipients: [{ label: 'Anna', email: 'anna at example' }] }, 400],
		['an empty label', { label: '   ' }, 400]
	])('refuses %s', (_name, overrides, expected) => {
		expect(failsWith(() => parseSecretInput(body(overrides), T0))).toBe(expected);
	});
});

describe('opening a link', () => {
	it('says ready and never returns the ciphertext', () => {
		const { links } = create(db);
		const result = openLink(db, links[0].token, T0 + 1);
		expect(result.state).toBe('ready');
		expect(JSON.stringify(result)).not.toContain(CIPHERTEXT);
	});

	it('can be repeated without spending the link', () => {
		const { links } = create(db);
		for (let i = 0; i < 5; i++) openLink(db, links[0].token, T0 + i);
		expect(revealSecret(db, links[0].token, T0 + 10).ciphertext_b64).toBe(CIPHERTEXT);
	});

	it('records the first open only', () => {
		const { id, links } = create(db);
		openLink(db, links[0].token, T0 + 1000);
		openLink(db, links[0].token, T0 + 5000);
		const anna = getSecret(db, ALICE, id, T0 + 6000).recipients[0];
		expect(anna.opened_at).toBe(new Date(T0 + 1000).toISOString());
		expect(anna.revealed_at).toBeNull();
	});

	it('gives the same 404 for an unknown, malformed or missing token', () => {
		create(db);
		const unknown = 'A'.repeat(43);
		for (const token of [unknown, 'short', '../../etc', 42, null, undefined]) {
			expect(failsWith(() => openLink(db, token, T0))).toBe(404);
		}
	});
});

describe('revealing', () => {
	it('works once per link, then answers 410', () => {
		const { links } = create(db);
		expect(revealSecret(db, links[0].token, T0 + 1)).toEqual({ ciphertext_b64: CIPHERTEXT, iv_b64: IV });
		expect(failsWith(() => revealSecret(db, links[0].token, T0 + 2))).toBe(410);
		expect(openLink(db, links[0].token, T0 + 3).state).toBe('revealed');
	});

	it('leaves the other recipients able to reveal', () => {
		const { links } = create(db);
		revealSecret(db, links[0].token, T0 + 1);
		expect(openLink(db, links[1].token, T0 + 2).state).toBe('ready');
		expect(revealSecret(db, links[1].token, T0 + 3).ciphertext_b64).toBe(CIPHERTEXT);
	});

	it('destroys the ciphertext at the last reveal', () => {
		const { id, links } = create(db);
		revealSecret(db, links[0].token, T0 + 1);
		revealSecret(db, links[1].token, T0 + 2);
		const row = db.prepare('SELECT status, ciphertext, iv, wiped_at FROM secrets WHERE id = ?').get(id);
		expect(row).toEqual({ status: 'burned', ciphertext: null, iv: null, wiped_at: T0 + 2 });
		expect(getSecret(db, ALICE, id, T0 + 3)).toMatchObject({ status: 'burned', revealed_count: 2 });
	});

	it('tells a recipient who has seen it so, even after the last reveal wiped it', () => {
		const { links } = create(db);
		revealSecret(db, links[0].token, T0 + 1);
		revealSecret(db, links[1].token, T0 + 2);
		expect(openLink(db, links[0].token, T0 + 3).state).toBe('revealed');
	});

	it('a second process on the same file sees the first reveal: one wins, one gets 410', () => {
		const file = `${process.env.TMPDIR ?? '/tmp'}/fulla-race-${process.pid}-${Date.now()}.db`;
		const a = openDb(file);
		const b = openDb(file);
		const { links } = create(a);
		const results = [a, b].map((conn) => failsWith(() => revealSecret(conn, links[0].token, T0 + 1)) ?? 200);
		expect(results.sort()).toEqual([200, 410]);
		a.close();
		b.close();
		for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true });
	});
});

describe('expiry', () => {
	it('wipes the secret the moment anyone touches it after expiry', () => {
		const { id, links } = create(db, { expires_at: new Date(T0 + HOUR).toISOString() });
		expect(openLink(db, links[0].token, T0 + HOUR).state).toBe('gone');
		expect(failsWith(() => revealSecret(db, links[1].token, T0 + HOUR))).toBe(410);
		const row = db.prepare('SELECT status, ciphertext FROM secrets WHERE id = ?').get(id);
		expect(row).toEqual({ status: 'expired', ciphertext: null });
	});

	it('keeps an expiry found during a failed reveal (no rollback)', () => {
		const { id, links } = create(db, { expires_at: new Date(T0 + HOUR).toISOString() });
		failsWith(() => revealSecret(db, links[0].token, T0 + 2 * HOUR));
		const row = db.prepare('SELECT status, ciphertext FROM secrets WHERE id = ?').get(id);
		expect(row).toEqual({ status: 'expired', ciphertext: null });
	});

	it('is also done by the sweep, without anyone opening a link', () => {
		create(db, { expires_at: new Date(T0 + HOUR).toISOString() });
		expect(sweep(db, T0 + 2 * HOUR)).toEqual({ expired: 1, deleted: 0 });
		const row = db.prepare('SELECT ciphertext FROM secrets').get();
		expect(row).toEqual({ ciphertext: null });
	});

	it('deletes wiped rows after the retention period, recipients included', () => {
		const { links } = create(db);
		revealSecret(db, links[0].token, T0 + 1);
		revealSecret(db, links[1].token, T0 + 2);
		expect(sweep(db, T0 + 2 + RETENTION_MS - 1).deleted).toBe(0);
		expect(sweep(db, T0 + 3 + RETENTION_MS).deleted).toBe(1);
		expect(db.prepare('SELECT COUNT(*) AS n FROM recipients').get()).toEqual({ n: 0 });
	});
});

describe('the creator', () => {
	it('sees only their own secrets', () => {
		create(db, {}, ALICE);
		const bobs = create(db, { label: 'Bob’s' }, 'bob@example.com');
		expect(listSecrets(db, ALICE, T0).map((s) => s.label)).toEqual(['Router']);
		expect(failsWith(() => getSecret(db, ALICE, bobs.id, T0))).toBe(404);
		expect(failsWith(() => revokeSecret(db, ALICE, bobs.id, T0))).toBe(404);
	});

	it('can revoke: the ciphertext goes and every link is gone', () => {
		const { id, links } = create(db);
		revokeSecret(db, ALICE, id, T0 + 1);
		expect(openLink(db, links[0].token, T0 + 2).state).toBe('gone');
		expect(failsWith(() => revealSecret(db, links[1].token, T0 + 3))).toBe(410);
		expect(getSecret(db, ALICE, id, T0 + 4).status).toBe('revoked');
	});

	it('sees times as UTC ISO strings', () => {
		const { id } = create(db);
		expect(getSecret(db, ALICE, id, T0).created_at).toBe('2026-11-13T12:00:00.000Z');
	});
});

describe('rate limit', () => {
	it('allows the budget, refuses the next one, and resets with the window', () => {
		const budget = { max: 3, windowMs: 1000 };
		const tries = [0, 1, 2, 3].map((i) => allow(db, 'ip:1', budget, T0 + i));
		expect(tries).toEqual([true, true, true, false]);
		expect(allow(db, 'ip:2', budget, T0 + 4)).toBe(true);
		expect(allow(db, 'ip:1', budget, T0 + 1000)).toBe(true);
	});
});
