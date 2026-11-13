import type { RequestHandler } from './$types';
import { handle, noStore, problem, readJson, tokenFrom, withinLinkBudget } from '$lib/server/http';
import { getDb } from '$lib/server/instance';
import { revealSecret } from '$lib/server/secrets';

/** The ciphertext, once per link. Called only when the recipient presses the button. */
export const POST: RequestHandler = (event) =>
	handle(async () => {
		if (!withinLinkBudget(event)) return problem(429, 'Too many requests. Try again in a few minutes.');
		const body = await readJson(event.request);
		return noStore(revealSecret(getDb(), tokenFrom(body), Date.now()));
	});
