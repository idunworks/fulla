import { rmSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import {
	LOGIN_TTL_MS,
	SESSION_TTL_MS,
	createLoginToken,
	createSession,
	endSession,
	isAllowed,
	normalizeEmail,
	parseAllowlist,
	pruneAuth,
	sessionEmail,
	spendLoginToken
} from './auth';
import { maskEmail } from './mailer';

const T0 = Date.parse('2026-11-14T09:00:00Z');
const ANNA = 'anna@example.com';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

function dump(table: string): string {
	return JSON.stringify(db.prepare(`SELECT * FROM ${table}`).all());
}

describe('the allowlist', () => {
	const list = parseAllowlist(' Anna@Example.com, @team.example ;bo@other.example  not-an-entry @');

	it('takes addresses and @domains, in any case, separated by commas, semicolons or spaces', () => {
		expect(isAllowed(list, 'anna@example.com')).toBe(true);
		expect(isAllowed(list, 'bo@other.example')).toBe(true);
		expect(isAllowed(list, 'anyone@team.example')).toBe(true);
	});

	it('lets nobody else in, including look-alike domains', () => {
		expect(isAllowed(list, 'eve@example.com')).toBe(false);
		expect(isAllowed(list, 'eve@evilteam.example')).toBe(false);
		expect(isAllowed(list, 'eve@team.example.evil')).toBe(false);
		expect(isAllowed(list, 'not-an-entry')).toBe(false);
	});

	it('is empty when the setting is missing: nobody can sign in', () => {
		const empty = parseAllowlist(undefined);
		expect(empty.addresses.size + empty.domains.size).toBe(0);
		expect(isAllowed(empty, ANNA)).toBe(false);
	});

	it('normalizes what people type and refuses what is not an address', () => {
		expect(normalizeEmail('  Anna@Example.COM ')).toBe(ANNA);
		for (const bad of ['', 'anna', 'anna@', 'a b@example.com', 42, null, `${'a'.repeat(250)}@x.se`]) {
			expect(normalizeEmail(bad)).toBeNull();
		}
	});
});

describe('sign-in links', () => {
	it('work once, and store only a hash', () => {
		const token = createLoginToken(db, ANNA, '/admin/x', T0) as string;
		expect(dump('login_tokens')).not.toContain(token);
		expect(spendLoginToken(db, token, T0 + 1000)).toEqual({ email: ANNA, next: '/admin/x' });
		expect(spendLoginToken(db, token, T0 + 2000)).toBeNull();
	});

	it('expire after the TTL', () => {
		const token = createLoginToken(db, ANNA, '/admin', T0) as string;
		expect(spendLoginToken(db, token, T0 + LOGIN_TTL_MS)).toBeNull();
	});

	it('are cancelled by asking for a new one', () => {
		const first = createLoginToken(db, ANNA, '/admin', T0) as string;
		const second = createLoginToken(db, ANNA, '/admin', T0 + 60_000) as string;
		expect(spendLoginToken(db, first, T0 + 61_000)).toBeNull();
		expect(spendLoginToken(db, second, T0 + 62_000)?.email).toBe(ANNA);
	});

	it('collapse a double submit into one email', () => {
		expect(createLoginToken(db, ANNA, '/admin', T0)).not.toBeNull();
		expect(createLoginToken(db, ANNA, '/admin', T0 + 500)).toBeNull();
		expect(createLoginToken(db, ANNA, '/admin', T0 + 2500)).not.toBeNull();
	});

	it('give the same null for every kind of bad token', () => {
		createLoginToken(db, ANNA, '/admin', T0);
		for (const bad of ['A'.repeat(43), 'short', '../x', 42, null, undefined, { token: 'x' }]) {
			expect(spendLoginToken(db, bad, T0 + 1)).toBeNull();
		}
	});

	it('cannot be spent twice by two connections racing on the same file', () => {
		const file = `${process.env.TMPDIR ?? '/tmp'}/fulla-auth-race-${process.pid}-${Date.now()}.db`;
		const a = openDb(file);
		const b = openDb(file);
		const token = createLoginToken(a, ANNA, '/admin', T0) as string;
		const wins = [a, b].map((conn) => spendLoginToken(conn, token, T0 + 1)).filter(Boolean);
		expect(wins).toHaveLength(1);
		a.close();
		b.close();
		for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true });
	});
});

describe('sessions', () => {
	it('find their address by the cookie value, which is never stored', () => {
		const { id } = createSession(db, ANNA, T0);
		expect(dump('sessions')).not.toContain(id);
		expect(sessionEmail(db, id, T0 + 1)).toBe(ANNA);
	});

	it('end at expiry, at sign-out, and for any made-up value', () => {
		const { id } = createSession(db, ANNA, T0);
		expect(sessionEmail(db, id, T0 + SESSION_TTL_MS)).toBeNull();
		const other = createSession(db, ANNA, T0).id;
		endSession(db, other);
		expect(sessionEmail(db, other, T0 + 1)).toBeNull();
		expect(sessionEmail(db, 'A'.repeat(43), T0)).toBeNull();
		expect(sessionEmail(db, undefined, T0)).toBeNull();
	});

	it('and old rows are pruned', () => {
		createSession(db, ANNA, T0);
		createLoginToken(db, ANNA, '/admin', T0);
		pruneAuth(db, T0 + 8 * 24 * 60 * 60 * 1000);
		expect(dump('sessions')).toBe('[]');
		expect(dump('login_tokens')).toBe('[]');
	});
});

describe('logs', () => {
	it('mask addresses', () => {
		expect(maskEmail(ANNA)).toBe('a***@example.com');
		expect(maskEmail('nope')).toBe('***');
	});
});
