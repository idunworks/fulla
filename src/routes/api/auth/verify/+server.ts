import type { RequestHandler } from './$types';
import { allow } from '$lib/server/rateLimit';
import { VERIFY_BUDGET, createSession, isAllowed, spendLoginToken } from '$lib/server/auth';
import { allowlist, demoMode } from '$lib/server/config';
import { handle, noStore, problem, readJson, tokenFrom } from '$lib/server/http';
import { getDb } from '$lib/server/instance';
import { setSessionCookie } from '$lib/server/session';

/** Spend a sign-in link's token and start a session. Only the page's button calls this. */
export const POST: RequestHandler = (event) =>
	handle(async () => {
		// The demo has no sign-in by email: see /api/auth/demo.
		if (demoMode()) return problem(404, 'Not found.');
		const db = getDb();
		const now = Date.now();
		if (!allow(db, `verify:${event.getClientAddress()}`, VERIFY_BUDGET, now)) {
			return problem(429, 'Too many attempts. Wait a few minutes.');
		}
		const spent = spendLoginToken(db, tokenFrom(await readJson(event.request)), now);
		// The allowlist is checked again: an address taken off it since the email went out gets nothing.
		if (!spent || !isAllowed(allowlist(), spent.email)) {
			return problem(400, 'This link has already been used or has expired.');
		}
		const session = createSession(db, spent.email, now);
		setSessionCookie(event.cookies, event.url, session.id, session.expiresAt);
		return noStore({ next: spent.next });
	});
