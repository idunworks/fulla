import type { RequestHandler } from './$types';
import { handle, noStore, problem } from '$lib/server/http';
import { getDb } from '$lib/server/instance';
import { getSecret, revokeSecret } from '$lib/server/secrets';

/** One of the creator's secrets, with each recipient's progress (never their tokens). */
export const GET: RequestHandler = ({ locals, params }) =>
	handle(() => {
		if (!locals.creator) return problem(401, 'Sign in first.');
		return noStore(getSecret(getDb(), locals.creator, params.id, Date.now()));
	});

/** Revoke: the ciphertext is destroyed now and every link stops working. */
export const DELETE: RequestHandler = ({ locals, params }) =>
	handle(() => {
		if (!locals.creator) return problem(401, 'Sign in first.');
		revokeSecret(getDb(), locals.creator, params.id, Date.now());
		return new Response(null, { status: 204 });
	});
