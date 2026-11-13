import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { pickLang } from '$lib/i18n';

/** Pages and answers that may carry a secret, or a link to one: never cached, anywhere. */
const PRIVATE_PATHS = ['/api/', '/view', '/admin'];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const handle: Handle = async ({ event, resolve }) => {
	// Filled by the sign-in step; until a creator signs in, only recipients' routes work.
	event.locals.creator = null;
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
	if (PRIVATE_PATHS.some((p) => event.url.pathname.startsWith(p))) {
		response.headers.set('Cache-Control', 'no-store');
	}
	return response;
};
