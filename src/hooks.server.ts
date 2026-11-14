import { base } from '$app/paths';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { pickLang } from '$lib/i18n';
import { creatorFor, sessionEmail } from '$lib/server/auth';
import { allowlist, demoMode } from '$lib/server/config';
import { getDb } from '$lib/server/instance';
import { readSessionCookie } from '$lib/server/session';

/** Pages and answers that may carry a secret, or a link to one: never cached, anywhere. */
const PRIVATE_PATHS = ['/api/', '/view', '/admin', '/auth'].map((p) => `${base}${p}`);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const handle: Handle = async ({ event, resolve }) => {
	// A signed-in creator, still on the allowlist (or a demo visitor, in the demo).
	// Recipients never have a session.
	const demo = demoMode();
	const email = sessionEmail(getDb(), readSessionCookie(event.cookies, event.url), Date.now());
	event.locals.creator = creatorFor(email, demo, allowlist());
	event.locals.demo = demo;
	event.locals.lang = pickLang(event.request.headers.get('accept-language'), env.FULLA_LANG);

	// Kit checks the origin of form posts. The API takes JSON, so check it here too:
	// a state-changing request must come from this site's own pages.
	if (!SAFE_METHODS.has(event.request.method)) {
		const origin = event.request.headers.get('origin');
		if (origin !== event.url.origin) {
			return new Response(JSON.stringify({ detail: 'Cross-site request refused.' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%fulla.lang%', event.locals.lang)
	});

	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
	// Nobody should find the demo through a search engine and take it for a service.
	if (demo) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	if (PRIVATE_PATHS.some((p) => event.url.pathname.startsWith(p))) {
		response.headers.set('Cache-Control', 'no-store');
	}
	return response;
};
