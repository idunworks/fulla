import type { RequestHandler } from './$types';
import { handle, noStore, problem, readJson } from '$lib/server/http';
import { getDb } from '$lib/server/instance';
import { createSecret, listSecrets, parseSecretInput } from '$lib/server/secrets';

/** The signed-in creator's secrets, newest first. */
export const GET: RequestHandler = ({ locals }) =>
	handle(() => {
		if (!locals.creator) return problem(401, 'Sign in first.');
		return noStore(listSecrets(getDb(), locals.creator, Date.now()));
	});

/** Store a secret the browser has already encrypted. The response is the only copy of the links' tokens. */
export const POST: RequestHandler = ({ locals, request }) =>
	handle(async () => {
		if (!locals.creator) return problem(401, 'Sign in first.');
		const now = Date.now();
		const input = parseSecretInput(await readJson(request), now);
		return noStore(createSecret(getDb(), locals.creator, input, now), 201);
	});
