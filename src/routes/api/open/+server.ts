import type { RequestHandler } from './$types';
import { handle, noStore, problem, readJson, tokenFrom, withinLinkBudget } from '$lib/server/http';
import { getDb } from '$lib/server/instance';
import { openLink } from '$lib/server/secrets';

/** What a link may do. Never the ciphertext, so opening the page spends nothing. */
export const POST: RequestHandler = (event) =>
	handle(async () => {
		if (!withinLinkBudget(event)) return problem(429, 'Too many requests. Try again in a few minutes.');
		const body = await readJson(event.request);
		return noStore(openLink(getDb(), tokenFrom(body), Date.now()));
	});
