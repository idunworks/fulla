/**
 * The app's single database connection and its housekeeping timer.
 * Everything else takes the connection as an argument, which keeps it testable.
 */
import { env } from '$env/dynamic/private';
import { openDb, type Db } from './db';
import { pruneRateLimits } from './rateLimit';
import { sweep } from './secrets';

const HOUSEKEEPING_EVERY_MS = 10 * 60 * 1000;
const RATE_LIMIT_MEMORY_MS = 24 * 60 * 60 * 1000;

let db: Db | null = null;

export function getDb(): Db {
	if (!db) {
		db = openDb(env.FULLA_DATABASE ?? './data/fulla.db');
		housekeeping(db);
		setInterval(() => housekeeping(db as Db), HOUSEKEEPING_EVERY_MS).unref();
	}
	return db;
}

function housekeeping(conn: Db): void {
	const now = Date.now();
	sweep(conn, now);
	pruneRateLimits(conn, now, RATE_LIMIT_MEMORY_MS);
	// Fold the write-ahead log back into the main file, so pages that held a
	// wiped ciphertext don't linger in fulla.db-wal.
	conn.pragma('wal_checkpoint(TRUNCATE)');
}
