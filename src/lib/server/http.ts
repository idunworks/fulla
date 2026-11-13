/** Small helpers shared by the API routes. Every error answers `{ detail }`. */
import { json, type RequestEvent } from '@sveltejs/kit';
import { FullaError } from './secrets';
import { allow, type Budget } from './rateLimit';
import { getDb } from './instance';

/** Above the 64 KiB ciphertext cap plus labels, well under anything abusive. */
const MAX_BODY_BYTES = 128 * 1024;

/** Per visitor, across open and reveal. Tokens are 256-bit: this guards the service, not the secrets. */
export const LINK_BUDGET: Budget = { max: 30, windowMs: 10 * 60 * 1000 };

export function problem(status: number, detail: string): Response {
	return json({ detail }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Run a handler; a broken rule becomes its status, anything else a bare 500. */
export async function handle(run: () => Promise<Response> | Response): Promise<Response> {
	try {
		return await run();
	} catch (err) {
		if (err instanceof FullaError) return problem(err.status, err.message);
		if (err instanceof BodyError) return problem(err.status, err.message);
		console.error('fulla: unexpected error', err);
		return problem(500, 'Something went wrong.');
	}
}

class BodyError extends Error {
	constructor(
		readonly status: 413 | 415 | 400,
		message: string
	) {
		super(message);
	}
}

/** Read a JSON body, refusing anything else or anything too big. */
export async function readJson(request: Request): Promise<unknown> {
	const type = request.headers.get('content-type') ?? '';
	if (!type.toLowerCase().startsWith('application/json')) {
		throw new BodyError(415, 'Send JSON.');
	}
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_BODY_BYTES) throw new BodyError(413, 'Request too large.');
	const text = await request.text();
	if (text.length > MAX_BODY_BYTES) throw new BodyError(413, 'Request too large.');
	try {
		return JSON.parse(text);
	} catch {
		throw new BodyError(400, 'Invalid JSON.');
	}
}

/** The token from a `{ token }` body, unchecked (the rules give one answer for every bad token). */
export function tokenFrom(body: unknown): unknown {
	return typeof body === 'object' && body !== null ? (body as { token?: unknown }).token : undefined;
}

export function withinLinkBudget(event: RequestEvent): boolean {
	return allow(getDb(), `link:${event.getClientAddress()}`, LINK_BUDGET, Date.now());
}

export function noStore(body: unknown, status = 200): Response {
	return json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
