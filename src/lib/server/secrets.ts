/**
 * The rules of a Fulla secret, in one place.
 *
 * - The server only ever holds ciphertext; the key is in the link's #fragment.
 * - Each recipient has their own link, and each link reveals the secret once.
 * - Opening a link never returns the ciphertext. Revealing does, once.
 * - When every recipient has revealed it, when it expires, or when its creator
 *   revokes it, the ciphertext is destroyed. The row itself goes after `retentionMs`.
 * - Only a SHA-256 of each token is stored, so the database cannot rebuild a link.
 *
 * Every function takes the database and the current time, so tests can drive
 * the clock instead of waiting.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Db } from './db';

export interface Limits {
	/** Base64 ciphertext characters. */
	maxCiphertextChars: number;
	maxRecipients: number;
	maxLabelChars: number;
	maxRecipientLabelChars: number;
	minLifetimeMs: number;
	maxLifetimeMs: number;
	/** How long a wiped secret's row (label, who revealed when) stays for its creator. */
	retentionMs: number;
	/** Whether recipients' email addresses are kept at all. */
	keepEmails: boolean;
	/** Live (unwiped) secrets one creator may hold, and the whole instance. */
	maxLivePerCreator: number;
	maxLiveTotal: number;
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export const LIMITS: Limits = {
	// 64 KiB is plenty for passwords, keys and notes.
	maxCiphertextChars: 64 * 1024,
	maxRecipients: 25,
	maxLabelChars: 200,
	maxRecipientLabelChars: 100,
	minLifetimeMs: 5 * MINUTE,
	maxLifetimeMs: 7 * DAY,
	retentionMs: 30 * DAY,
	keepEmails: true,
	maxLivePerCreator: Number.POSITIVE_INFINITY,
	maxLiveTotal: Number.POSITIVE_INFINITY
};

/**
 * The public demo (FULLA_DEMO=true): anyone may create, so everything is
 * small and short-lived, and nothing personal is kept.
 */
export const DEMO_LIMITS: Limits = {
	...LIMITS,
	maxCiphertextChars: 4 * 1024,
	maxRecipients: 3,
	maxLifetimeMs: 10 * MINUTE,
	retentionMs: 60 * MINUTE,
	keepEmails: false,
	maxLivePerCreator: 10,
	maxLiveTotal: 300
};

/** Kept for callers that only need the default. */
export const RETENTION_MS = LIMITS.retentionMs;

const IV_BYTES = 12;
const TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const BASE64_SHAPE = /^[A-Za-z0-9+/]+={0,2}$/;
// Deliberately loose: the address is only shown to the creator, never mailed to.
const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

export type SecretStatus = 'active' | 'expired' | 'burned' | 'revoked';

/** A rule was broken. `status` is the HTTP status the API should answer with. */
export class FullaError extends Error {
	constructor(
		readonly status: 400 | 404 | 410 | 413 | 503,
		message: string
	) {
		super(message);
		this.name = 'FullaError';
	}
}

// ── Input ─────────────────────────────────────────────────────────

export interface RecipientInput {
	label: string;
	email?: string | null;
}

export interface SecretInput {
	label: string;
	ciphertext_b64: string;
	iv_b64: string;
	expires_at: string;
	recipients: RecipientInput[];
}

/** Check an untrusted request body. Returns a clean copy or throws FullaError(400/413). */
export function parseSecretInput(
	body: unknown,
	now: number,
	limits: Limits = LIMITS
): SecretInput & { expiresAtMs: number } {
	if (!isRecord(body)) throw new FullaError(400, 'Expected a JSON object.');
	const label = text(body.label, 'label', limits.maxLabelChars);
	const ciphertext_b64 = base64(body.ciphertext_b64, 'ciphertext_b64');
	if (ciphertext_b64.length > limits.maxCiphertextChars) {
		throw new FullaError(413, 'The secret is too large.');
	}
	const iv_b64 = base64(body.iv_b64, 'iv_b64');
	if (Buffer.from(iv_b64, 'base64').length !== IV_BYTES) {
		throw new FullaError(400, 'iv_b64 must be 12 bytes.');
	}

	const expiresAtMs = typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : NaN;
	if (!Number.isFinite(expiresAtMs)) throw new FullaError(400, 'expires_at must be a date.');
	const lifetime = expiresAtMs - now;
	if (lifetime < limits.minLifetimeMs || lifetime > limits.maxLifetimeMs) {
		throw new FullaError(
			400,
			`expires_at must be between ${span(limits.minLifetimeMs)} and ${span(limits.maxLifetimeMs)} from now.`
		);
	}

	if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
		throw new FullaError(400, 'Add at least one recipient.');
	}
	if (body.recipients.length > limits.maxRecipients) {
		throw new FullaError(400, `At most ${limits.maxRecipients} recipients.`);
	}
	const recipients = body.recipients.map((r: unknown, i: number): RecipientInput => {
		if (!isRecord(r)) throw new FullaError(400, `Recipient ${i + 1} is not an object.`);
		const email = r.email == null || r.email === '' ? null : String(r.email).trim();
		if (email !== null && !EMAIL_SHAPE.test(email)) {
			throw new FullaError(400, `Recipient ${i + 1}: that email address doesn't look right.`);
		}
		return {
			label: text(r.label, `recipient ${i + 1} label`, limits.maxRecipientLabelChars),
			email: limits.keepEmails ? email : null
		};
	});

	return {
		label,
		ciphertext_b64,
		iv_b64,
		expires_at: new Date(expiresAtMs).toISOString(),
		expiresAtMs,
		recipients
	};
}

/** "10 minutes", "7 days": for error messages. */
function span(ms: number): string {
	if (ms >= DAY && ms % DAY === 0) return `${ms / DAY} day${ms === DAY ? '' : 's'}`;
	const minutes = Math.round(ms / MINUTE);
	return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, name: string, max: number): string {
	const clean = typeof value === 'string' ? value.trim() : '';
	if (!clean) throw new FullaError(400, `${name} is required.`);
	if (clean.length > max) throw new FullaError(400, `${name} is longer than ${max} characters.`);
	return clean;
}

function base64(value: unknown, name: string): string {
	if (typeof value !== 'string' || !BASE64_SHAPE.test(value)) {
		throw new FullaError(400, `${name} must be base64.`);
	}
	return value;
}

// ── Tokens ────────────────────────────────────────────────────────

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function newToken(): string {
	return randomBytes(TOKEN_BYTES).toString('base64url');
}

// ── Creator side ──────────────────────────────────────────────────

export interface CreatedSecret {
	id: string;
	label: string;
	expires_at: string;
	/** The only time the tokens exist outside the recipients' links. */
	links: { label: string; token: string }[];
}

/** Refuse a new secret when the creator or the instance already holds its share of live ones. */
function checkCapacity(db: Db, creator: string, now: number, limits: Limits): void {
	if (Number.isFinite(limits.maxLivePerCreator)) {
		const { mine } = db
			.prepare(`SELECT COUNT(*) AS mine FROM secrets WHERE creator = ? AND wiped_at IS NULL AND expires_at > ?`)
			.get(creator, now) as { mine: number };
		if (mine >= limits.maxLivePerCreator) {
			throw new FullaError(503, `You already have ${mine} live secrets. Revoke one or wait for one to expire.`);
		}
	}
	if (Number.isFinite(limits.maxLiveTotal)) {
		const { total } = db
			.prepare(`SELECT COUNT(*) AS total FROM secrets WHERE wiped_at IS NULL AND expires_at > ?`)
			.get(now) as { total: number };
		if (total >= limits.maxLiveTotal) throw new FullaError(503, 'This instance is busy. Try again in a few minutes.');
	}
}

export function createSecret(
	db: Db,
	creator: string,
	input: SecretInput & { expiresAtMs: number },
	now: number,
	limits: Limits = LIMITS
): CreatedSecret {
	checkCapacity(db, creator, now, limits);
	const id = randomUUID();
	const links = input.recipients.map((r) => ({ label: r.label, email: r.email ?? null, token: newToken() }));

	db.transaction(() => {
		db.prepare(
			`INSERT INTO secrets (id, creator, label, ciphertext, iv, status, expires_at, created_at)
			 VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
		).run(id, creator, input.label, Buffer.from(input.ciphertext_b64, 'base64'), Buffer.from(input.iv_b64, 'base64'), input.expiresAtMs, now);
		const addRecipient = db.prepare(
			`INSERT INTO recipients (id, secret_id, token_hash, label, email, created_at) VALUES (?, ?, ?, ?, ?, ?)`
		);
		for (const link of links) addRecipient.run(randomUUID(), id, hashToken(link.token), link.label, link.email, now);
	})();

	return {
		id,
		label: input.label,
		expires_at: input.expires_at,
		links: links.map(({ label, token }) => ({ label, token }))
	};
}

export interface SecretSummary {
	id: string;
	label: string;
	status: SecretStatus;
	expires_at: string;
	wiped_at: string | null;
	created_at: string;
	recipient_count: number;
	opened_count: number;
	revealed_count: number;
}

export interface RecipientStatus {
	id: string;
	label: string;
	email: string | null;
	opened_at: string | null;
	revealed_at: string | null;
}

export interface SecretDetail extends SecretSummary {
	recipients: RecipientStatus[];
}

interface SummaryRow {
	id: string;
	label: string;
	status: SecretStatus;
	expires_at: number;
	wiped_at: number | null;
	created_at: number;
	recipient_count: number;
	opened_count: number;
	revealed_count: number;
}

const SUMMARY_SQL = `
	SELECT s.id, s.label, s.status, s.expires_at, s.wiped_at, s.created_at,
	       COUNT(r.id)            AS recipient_count,
	       COUNT(r.opened_at)     AS opened_count,
	       COUNT(r.revealed_at)   AS revealed_count
	FROM secrets s LEFT JOIN recipients r ON r.secret_id = s.id`;

/** The creator's own secrets, newest first. Never another creator's. */
export function listSecrets(db: Db, creator: string, now: number): SecretSummary[] {
	sweep(db, now);
	const rows = db
		.prepare(`${SUMMARY_SQL} WHERE s.creator = ? GROUP BY s.id ORDER BY s.created_at DESC`)
		.all(creator) as SummaryRow[];
	return rows.map(toSummary);
}

/** One of the creator's secrets with each recipient's progress. Not found if it isn't theirs. */
export function getSecret(db: Db, creator: string, id: string, now: number): SecretDetail {
	sweep(db, now);
	const row = db
		.prepare(`${SUMMARY_SQL} WHERE s.id = ? AND s.creator = ? GROUP BY s.id`)
		.get(id, creator) as SummaryRow | undefined;
	if (!row) throw new FullaError(404, 'Secret not found.');
	const recipients = db
		.prepare(
			`SELECT id, label, email, opened_at, revealed_at FROM recipients WHERE secret_id = ? ORDER BY created_at, rowid`
		)
		.all(id) as { id: string; label: string; email: string | null; opened_at: number | null; revealed_at: number | null }[];
	return {
		...toSummary(row),
		recipients: recipients.map((r) => ({
			id: r.id,
			label: r.label,
			email: r.email,
			opened_at: iso(r.opened_at),
			revealed_at: iso(r.revealed_at)
		}))
	};
}

/** Destroy the ciphertext now. Every link stops working; the row stays for the record. */
export function revokeSecret(db: Db, creator: string, id: string, now: number): void {
	const result = db
		.prepare(
			`UPDATE secrets SET status = 'revoked', ciphertext = NULL, iv = NULL, wiped_at = ?
			 WHERE id = ? AND creator = ? AND status = 'active'`
		)
		.run(now, id, creator);
	if (result.changes === 0) {
		const exists = db.prepare(`SELECT 1 FROM secrets WHERE id = ? AND creator = ?`).get(id, creator);
		if (!exists) throw new FullaError(404, 'Secret not found.');
	}
}

function toSummary(row: SummaryRow): SecretSummary {
	return {
		id: row.id,
		label: row.label,
		status: row.status,
		expires_at: new Date(row.expires_at).toISOString(),
		wiped_at: iso(row.wiped_at),
		created_at: new Date(row.created_at).toISOString(),
		recipient_count: row.recipient_count,
		opened_count: row.opened_count,
		revealed_count: row.revealed_count
	};
}

/** Times leave the server as ISO strings with a Z, so no browser reads them as local time. */
function iso(ms: number | null): string | null {
	return ms === null ? null : new Date(ms).toISOString();
}

// ── Recipient side ────────────────────────────────────────────────

export type LinkState = 'ready' | 'revealed' | 'gone';

export interface OpenResult {
	state: LinkState;
	/** Only while the link can still be used. */
	expires_at: string | null;
}

export interface RevealResult {
	ciphertext_b64: string;
	iv_b64: string;
}

interface LinkRow {
	recipient_id: string;
	revealed_at: number | null;
	secret_id: string;
	status: SecretStatus;
	expires_at: number;
}

function findLink(db: Db, token: unknown): LinkRow {
	// One answer for every bad token, whatever is wrong with it.
	if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) {
		throw new FullaError(404, "This link isn't valid.");
	}
	const row = db
		.prepare(
			`SELECT r.id AS recipient_id, r.revealed_at, s.id AS secret_id, s.status, s.expires_at
			 FROM recipients r JOIN secrets s ON s.id = r.secret_id
			 WHERE r.token_hash = ?`
		)
		.get(hashToken(token)) as LinkRow | undefined;
	if (!row) throw new FullaError(404, "This link isn't valid.");
	return row;
}

function expireIfDue(db: Db, link: LinkRow, now: number): SecretStatus {
	if (link.status === 'active' && link.expires_at <= now) {
		db.prepare(
			`UPDATE secrets SET status = 'expired', ciphertext = NULL, iv = NULL, wiped_at = ? WHERE id = ? AND status = 'active'`
		).run(now, link.secret_id);
		return 'expired';
	}
	return link.status;
}

/**
 * What a link may do. Safe to call when the page loads: it records the first
 * open and never returns the ciphertext, so a scanner that opens the page
 * learns nothing and spends nothing.
 */
export function openLink(db: Db, token: unknown, now: number): OpenResult {
	return db
		.transaction((): OpenResult => {
			const link = findLink(db, token);
			const status = expireIfDue(db, link, now);
			db.prepare(`UPDATE recipients SET opened_at = ? WHERE id = ? AND opened_at IS NULL`).run(
				now,
				link.recipient_id
			);
			// Someone who has seen it is told so, even after it was wiped for everyone.
			if (link.revealed_at !== null) return { state: 'revealed', expires_at: null };
			if (status !== 'active') return { state: 'gone', expires_at: null };
			return { state: 'ready', expires_at: new Date(link.expires_at).toISOString() };
		})
		.immediate();
}

/**
 * Hand over the ciphertext, once per link. The last recipient's reveal destroys it.
 *
 * Runs as one IMMEDIATE transaction: it takes SQLite's write lock before it
 * reads, so two reveals at the same moment (even from two processes sharing
 * the file) are serialised, and exactly one of them is the last.
 */
export function revealSecret(db: Db, token: unknown, now: number): RevealResult {
	const outcome = db
		.transaction((): RevealResult | FullaError => {
			const link = findLink(db, token);
			const status = expireIfDue(db, link, now);
			// Returned, not thrown, so an expiry found here is committed, not rolled back.
			if (status !== 'active') return new FullaError(410, 'This secret is gone.');
			if (link.revealed_at !== null) return new FullaError(410, 'This link has already been used.');

			db.prepare(
				`UPDATE recipients SET revealed_at = ?, opened_at = COALESCE(opened_at, ?) WHERE id = ?`
			).run(now, now, link.recipient_id);
			const sealed = db
				.prepare(`SELECT ciphertext, iv FROM secrets WHERE id = ?`)
				.get(link.secret_id) as { ciphertext: Buffer; iv: Buffer };

			const { waiting } = db
				.prepare(`SELECT COUNT(*) AS waiting FROM recipients WHERE secret_id = ? AND revealed_at IS NULL`)
				.get(link.secret_id) as { waiting: number };
			if (waiting === 0) {
				db.prepare(
					`UPDATE secrets SET status = 'burned', ciphertext = NULL, iv = NULL, wiped_at = ? WHERE id = ?`
				).run(now, link.secret_id);
			}
			return { ciphertext_b64: sealed.ciphertext.toString('base64'), iv_b64: sealed.iv.toString('base64') };
		})
		.immediate();
	if (outcome instanceof FullaError) throw outcome;
	return outcome;
}

// ── Housekeeping ──────────────────────────────────────────────────

/** Wipe what has expired and delete rows wiped longer ago than `retentionMs`. */
export function sweep(db: Db, now: number, retentionMs: number = LIMITS.retentionMs): { expired: number; deleted: number } {
	return db.transaction(() => {
		const expired = db
			.prepare(
				`UPDATE secrets SET status = 'expired', ciphertext = NULL, iv = NULL, wiped_at = ?
				 WHERE status = 'active' AND expires_at <= ?`
			)
			.run(now, now).changes;
		const deleted = db.prepare(`DELETE FROM secrets WHERE wiped_at < ?`).run(now - retentionMs).changes;
		return { expired, deleted };
	})();
}
