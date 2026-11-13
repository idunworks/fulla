/**
 * One SQLite file holds everything. The schema is created on start and each
 * change is a numbered step, so an old file is brought up to date in place.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = Database.Database;

const MIGRATIONS: readonly string[] = [
	`CREATE TABLE secrets (
		id          TEXT PRIMARY KEY,
		creator     TEXT NOT NULL,
		label       TEXT NOT NULL,
		ciphertext  BLOB,
		iv          BLOB,
		status      TEXT NOT NULL CHECK (status IN ('active', 'expired', 'burned', 'revoked')),
		expires_at  INTEGER NOT NULL,
		wiped_at    INTEGER,
		created_at  INTEGER NOT NULL
	);
	CREATE INDEX secrets_creator ON secrets (creator, created_at);
	CREATE INDEX secrets_expiry ON secrets (status, expires_at);
	CREATE INDEX secrets_wiped ON secrets (wiped_at);

	CREATE TABLE recipients (
		id          TEXT PRIMARY KEY,
		secret_id   TEXT NOT NULL REFERENCES secrets (id) ON DELETE CASCADE,
		token_hash  TEXT NOT NULL UNIQUE,
		label       TEXT NOT NULL,
		email       TEXT,
		opened_at   INTEGER,
		revealed_at INTEGER,
		created_at  INTEGER NOT NULL
	);
	CREATE INDEX recipients_secret ON recipients (secret_id);

	CREATE TABLE rate_limits (
		key          TEXT PRIMARY KEY,
		window_start INTEGER NOT NULL,
		count        INTEGER NOT NULL
	);`
];

/** Open (or create) the database file and bring its schema up to date. */
export function openDb(path: string): Db {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	// Deleted rows are overwritten, not just unlinked from the file.
	db.pragma('secure_delete = ON');
	migrate(db);
	return db;
}

function migrate(db: Db): void {
	const current = db.pragma('user_version', { simple: true }) as number;
	for (let step = current; step < MIGRATIONS.length; step++) {
		db.transaction(() => {
			db.exec(MIGRATIONS[step]);
			db.pragma(`user_version = ${step + 1}`);
		})();
	}
}
