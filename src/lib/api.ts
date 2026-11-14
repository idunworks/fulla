/** The browser's side of the API. Errors keep their HTTP status so pages can show the right state. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(path, {
		...init,
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
	});
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new ApiError(res.status, typeof body?.detail === 'string' ? body.detail : `HTTP ${res.status}`);
	}
	return res.status === 204 ? (undefined as T) : res.json();
}

export interface OpenResult {
	state: 'ready' | 'revealed' | 'gone';
	expires_at: string | null;
}

export interface Sealed {
	ciphertext_b64: string;
	iv_b64: string;
}

/** What the link may do. Safe on page load: it never returns the secret. */
export const openLink = (token: string) =>
	call<OpenResult>('/api/open', { method: 'POST', body: JSON.stringify({ token }) });

/** The ciphertext, once. Only when the recipient presses the button. */
export const revealSecret = (token: string) =>
	call<Sealed>('/api/reveal', { method: 'POST', body: JSON.stringify({ token }) });

// ── The creator's side ────────────────────────────────────────────

/** Always answers the same for an address that may not sign in. */
export const requestSignInLink = (email: string, next: string) =>
	call<{ detail: string }>('/api/auth/link', { method: 'POST', body: JSON.stringify({ email, next }) });

/** Spend the emailed token; the server sets the session cookie. */
export const verifySignIn = (token: string) =>
	call<{ next: string }>('/api/auth/verify', { method: 'POST', body: JSON.stringify({ token }) });

export const signOut = () => call<void>('/api/auth/logout', { method: 'POST', body: '{}' });

export interface NewSecret {
	label: string;
	ciphertext_b64: string;
	iv_b64: string;
	expires_at: string;
	recipients: { label: string; email?: string }[];
}

export interface CreatedSecret {
	id: string;
	label: string;
	expires_at: string;
	/** The only time the tokens exist outside the recipients' links. */
	links: { label: string; token: string }[];
}

export const createSecret = (secret: NewSecret) =>
	call<CreatedSecret>('/api/secrets', { method: 'POST', body: JSON.stringify(secret) });

export const revokeSecret = (id: string) =>
	call<void>(`/api/secrets/${encodeURIComponent(id)}`, { method: 'DELETE' });
