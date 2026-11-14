/**
 * Creators sign in with an emailed one-time link. There are no passwords.
 *
 * - Only addresses on the allowlist (FULLA_ALLOWED_EMAILS) can sign in. The
 *   page answers the same for every address, so it never tells a stranger
 *   who is on the list.
 * - A link works once, for LOGIN_TTL_MS. Asking for a new one cancels the
 *   older unused ones. Only a SHA-256 of the token is stored.
 * - The token travels in the link's #fragment and is spent by a POST from the
 *   page, so a mail scanner that opens every link spends nothing.
 * - A session is a random id in an httpOnly cookie; the database holds only
 *   its hash. Every request checks the allowlist again, so taking an address
 *   off the list ends its sessions at once.
 *
 * Every function takes the database and the current time, like secrets.ts.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from './db';
import type { Budget } from './rateLimit';

export const LOGIN_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Used and expired sign-in links are kept this long, then deleted. */
const LOGIN_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** One click that reached the server twice sends one email, not two. */
const DOUBLE_SUBMIT_MS = 2000;

/** Link requests per visitor address, whatever email they type. */
export const LINK_REQUEST_BUDGET: Budget = { max: 5, windowMs: 15 * 60 * 1000 };
/** Emails sent to one allowed address: a stranger can't flood a creator's inbox. */
export const MAILS_PER_ADDRESS_BUDGET: Budget = { max: 3, windowMs: 15 * 60 * 1000 };
/** Sign-in attempts per visitor address. */
export const VERIFY_BUDGET: Budget = { max: 20, windowMs: 15 * 60 * 1000 };

/** The public demo (FULLA_DEMO=true): a throwaway creator per browser, no email. */
export const DEMO_SESSION_TTL_MS = 60 * 60 * 1000;
/** Demo sessions started per visitor address. */
export const DEMO_START_BUDGET: Budget = { max: 10, windowMs: 15 * 60 * 1000 };
const DEMO_EMAIL_SHAPE = /^demo-[0-9a-f]{16}@demo\.invalid$/;

const TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;
const DOMAIN_SHAPE = /^@[^\s@]{1,190}\.[^\s@]{2,63}$/;

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function newToken(): string {
	return randomBytes(TOKEN_BYTES).toString('base64url');
}

// ── Allowlist ─────────────────────────────────────────────────────

export interface Allowlist {
	addresses: ReadonlySet<string>;
	/** Entries like "@example.com", stored without the @. */
	domains: ReadonlySet<string>;
}

/** A trimmed, lower-case address, or null if it doesn't look like one. */
export function normalizeEmail(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const email = value.trim().toLowerCase();
	return email.length <= 254 && EMAIL_SHAPE.test(email) ? email : null;
}

/** `FULLA_ALLOWED_EMAILS`: addresses and @domains, separated by commas or spaces. */
export function parseAllowlist(raw: string | undefined): Allowlist {
	const entries = (raw ?? '')
		.split(/[\s,;]+/)
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	return {
		addresses: new Set(entries.filter((e) => EMAIL_SHAPE.test(e))),
		domains: new Set(entries.filter((e) => DOMAIN_SHAPE.test(e)).map((e) => e.slice(1)))
	};
}

export function isAllowed(list: Allowlist, email: string): boolean {
	const domain = email.slice(email.lastIndexOf('@') + 1);
	return list.addresses.has(email) || list.domains.has(domain);
}

// ── Sign-in links ─────────────────────────────────────────────────

/**
 * A new sign-in token for an address the caller has already checked against
 * the allowlist. Cancels the address's older unused links. Returns null for
 * a double submit (the first request's mail is on its way).
 */
export function createLoginToken(db: Db, email: string, next: string, now: number): string | null {
	return db
		.transaction((): string | null => {
			const latest = db
				.prepare(`SELECT MAX(created_at) AS at FROM login_tokens WHERE email = ?`)
				.get(email) as { at: number | null };
			if (latest.at !== null && now - latest.at < DOUBLE_SUBMIT_MS) return null;

			db.prepare(`UPDATE login_tokens SET used_at = ? WHERE email = ? AND used_at IS NULL`).run(now, email);
			const token = newToken();
			db.prepare(
				`INSERT INTO login_tokens (token_hash, email, next, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
			).run(sha256(token), email, next, now + LOGIN_TTL_MS, now);
			return token;
		})
		.immediate();
}

/**
 * Spend a sign-in token. One statement marks it used, so two tabs racing
 * with the same link can't both succeed. Null for anything unknown, used,
 * expired or malformed: the page says the same thing for all of them.
 */
export function spendLoginToken(db: Db, token: unknown, now: number): { email: string; next: string } | null {
	if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) return null;
	const row = db
		.prepare(
			`UPDATE login_tokens SET used_at = ?
			 WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
			 RETURNING email, next`
		)
		.get(now, sha256(token), now) as { email: string; next: string } | undefined;
	return row ?? null;
}

// ── Sessions ──────────────────────────────────────────────────────

export function createSession(
	db: Db,
	email: string,
	now: number,
	ttlMs: number = SESSION_TTL_MS
): { id: string; expiresAt: number } {
	const id = newToken();
	const expiresAt = now + ttlMs;
	db.prepare(`INSERT INTO sessions (id_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(
		sha256(id),
		email,
		expiresAt,
		now
	);
	return { id, expiresAt };
}

/** The address a session cookie belongs to, or null. The caller checks the allowlist. */
export function sessionEmail(db: Db, id: string | undefined, now: number): string | null {
	if (!id || !TOKEN_SHAPE.test(id)) return null;
	const row = db
		.prepare(`SELECT email FROM sessions WHERE id_hash = ? AND expires_at > ?`)
		.get(sha256(id), now) as { email: string } | undefined;
	return row?.email ?? null;
}

export function endSession(db: Db, id: string | undefined): void {
	if (id && TOKEN_SHAPE.test(id)) db.prepare(`DELETE FROM sessions WHERE id_hash = ?`).run(sha256(id));
}

/** A made-up creator address for one demo session. `.invalid` can never receive mail. */
export function newDemoEmail(): string {
	return `demo-${randomBytes(8).toString('hex')}@demo.invalid`;
}

export function isDemoEmail(email: string): boolean {
	return DEMO_EMAIL_SHAPE.test(email);
}

/**
 * Who a session's address counts as. In the demo only demo addresses count;
 * otherwise only allowlisted ones, and a demo address never does, whatever
 * the allowlist says.
 */
export function creatorFor(email: string | null, demo: boolean, list: Allowlist): string | null {
	if (!email) return null;
	if (demo) return isDemoEmail(email) ? email : null;
	return !isDemoEmail(email) && isAllowed(list, email) ? email : null;
}

/** Forget expired sessions and old sign-in links. */
export function pruneAuth(db: Db, now: number): void {
	db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(now);
	db.prepare(`DELETE FROM login_tokens WHERE created_at < ?`).run(now - LOGIN_TOKEN_RETENTION_MS);
}
