/** The public demo's rules (FULLA_DEMO=true): small, short-lived, nothing personal kept. */
import { beforeEach, describe, expect, it } from 'vitest';
import { creatorFor, isDemoEmail, newDemoEmail, parseAllowlist } from './auth';
import { openDb, type Db } from './db';
import { DEMO_LIMITS, FullaError, LIMITS, createSecret, parseSecretInput, revokeSecret, sweep } from './secrets';

const T0 = Date.parse('2026-11-14T12:00:00Z');
const MINUTE = 60 * 1000;
const IV = Buffer.alloc(12, 7).toString('base64');
const CIPHERTEXT = Buffer.from('demo').toString('base64');

function body(overrides: Record<string, unknown> = {}) {
	return {
		label: 'Try',
		ciphertext_b64: CIPHERTEXT,
		iv_b64: IV,
		expires_at: new Date(T0 + 10 * MINUTE).toISOString(),
		recipients: [{ label: 'Anna', email: 'anna@example.com' }],
		...overrides
	};
}

function failsWith(fn: () => unknown): number | undefined {
	try {
		fn();
	} catch (err) {
		return err instanceof FullaError ? err.status : -1;
	}
	return undefined;
}

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const demoCreate = (creator: string, now = T0) =>
	createSecret(
		db,
		creator,
		parseSecretInput(body({ expires_at: new Date(now + 10 * MINUTE).toISOString() }), now, DEMO_LIMITS),
		now,
		DEMO_LIMITS
	);

describe('demo limits', () => {
	it('allows 10 minutes and no more', () => {
		expect(failsWith(() => parseSecretInput(body(), T0, DEMO_LIMITS))).toBeUndefined();
		const eleven = body({ expires_at: new Date(T0 + 11 * MINUTE).toISOString() });
		expect(failsWith(() => parseSecretInput(eleven, T0, DEMO_LIMITS))).toBe(400);
		expect(() => parseSecretInput(eleven, T0, DEMO_LIMITS)).toThrow('between 5 minutes and 10 minutes');
		// The same request is fine on a normal instance.
		expect(failsWith(() => parseSecretInput(eleven, T0, LIMITS))).toBeUndefined();
	});

	it('allows 3 recipients and no more', () => {
		const four = body({ recipients: ['A', 'B', 'C', 'D'].map((label) => ({ label })) });
		expect(failsWith(() => parseSecretInput(four, T0, DEMO_LIMITS))).toBe(400);
	});

	it('refuses a secret over 4 KiB', () => {
		const big = body({ ciphertext_b64: 'A'.repeat(DEMO_LIMITS.maxCiphertextChars + 4) });
		expect(failsWith(() => parseSecretInput(big, T0, DEMO_LIMITS))).toBe(413);
	});

	it('never keeps a recipient email', () => {
		expect(parseSecretInput(body(), T0, DEMO_LIMITS).recipients[0].email).toBeNull();
		expect(parseSecretInput(body(), T0, LIMITS).recipients[0].email).toBe('anna@example.com');
	});
});

describe('demo capacity', () => {
	it('lets one visitor hold 10 live secrets, and frees a slot when one is wiped', () => {
		const me = newDemoEmail();
		const made = Array.from({ length: 10 }, () => demoCreate(me));
		expect(failsWith(() => demoCreate(me))).toBe(503);
		// Someone else is not affected.
		expect(failsWith(() => demoCreate(newDemoEmail()))).toBeUndefined();
		revokeSecret(db, me, made[0].id, T0);
		expect(failsWith(() => demoCreate(me))).toBeUndefined();
	});

	it('expired secrets stop counting before the sweep runs', () => {
		const me = newDemoEmail();
		for (let i = 0; i < 10; i++) demoCreate(me);
		expect(failsWith(() => demoCreate(me, T0 + 11 * MINUTE))).toBeUndefined();
	});

	it('caps the whole instance', () => {
		for (let i = 0; i < DEMO_LIMITS.maxLiveTotal; i++) demoCreate(`v${i}`);
		expect(failsWith(() => demoCreate(newDemoEmail()))).toBe(503);
	});

	it('deletes wiped rows after an hour, not 30 days', () => {
		demoCreate(newDemoEmail());
		sweep(db, T0 + 10 * MINUTE, DEMO_LIMITS.retentionMs);
		expect(sweep(db, T0 + 69 * MINUTE, DEMO_LIMITS.retentionMs).deleted).toBe(0);
		expect(sweep(db, T0 + 71 * MINUTE, DEMO_LIMITS.retentionMs).deleted).toBe(1);
	});

	it('a normal instance has no capacity cap', () => {
		const input = parseSecretInput(body(), T0, LIMITS);
		for (let i = 0; i < 20; i++) createSecret(db, 'alice@example.com', input, T0);
		expect(failsWith(() => createSecret(db, 'alice@example.com', input, T0))).toBeUndefined();
	});
});

describe('demo sessions', () => {
	const list = parseAllowlist('alice@example.com,@demo.invalid');

	it('makes addresses that can never receive mail, unique each time', () => {
		const a = newDemoEmail();
		expect(isDemoEmail(a)).toBe(true);
		expect(a.endsWith('@demo.invalid')).toBe(true);
		expect(newDemoEmail()).not.toBe(a);
	});

	it('counts only demo addresses in the demo', () => {
		const demo = newDemoEmail();
		expect(creatorFor(demo, true, list)).toBe(demo);
		expect(creatorFor('alice@example.com', true, list)).toBeNull();
	});

	it('never counts a demo address outside the demo, even if the allowlist would', () => {
		expect(creatorFor(newDemoEmail(), false, list)).toBeNull();
		expect(creatorFor('alice@example.com', false, list)).toBe('alice@example.com');
		expect(creatorFor(null, false, list)).toBeNull();
	});
});
