import type { RequestHandler } from './$types';
import { allow } from '$lib/server/rateLimit';
import { DEMO_SESSION_TTL_MS, DEMO_START_BUDGET, createSession, newDemoEmail } from '$lib/server/auth';
import { demoMode } from '$lib/server/config';
import { handle, noStore, problem } from '$lib/server/http';
import { getDb } from '$lib/server/instance';
import { setSessionCookie } from '$lib/server/session';

/**
 * The demo's "sign-in": a throwaway creator for this browser, for an hour.
 * A POST from the page's button, like every other change, so a crawler that
 * follows links starts nothing.
 */
export const POST: RequestHandler = (event) =>
	handle(() => {
		if (!demoMode()) return problem(404, 'Not found.');
		const db = getDb();
		const now = Date.now();
		if (!allow(db, `demo:${event.getClientAddress()}`, DEMO_START_BUDGET, now)) {
			return problem(429, 'Too many attempts. Wait a few minutes.');
		}
		const session = createSession(db, newDemoEmail(), now, DEMO_SESSION_TTL_MS);
		setSessionCookie(event.cookies, event.url, session.id, session.expiresAt);
		return noStore({ ok: true }, 201);
	});
