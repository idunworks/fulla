/**
 * Fulla's browser-side encryption, using only the Web Crypto API (AES-256-GCM).
 *
 * The key is made in the sender's browser and travels in the link's #fragment
 * (#t=<token>&key=<key>). Browsers never send the fragment to a server, so the
 * server stores ciphertext it cannot read. This file has no dependencies, on
 * purpose: it is the part to audit.
 */

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/** Base64url encode (URL-safe, no padding) */
function toBase64Url(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url decode */
function fromBase64Url(str: string): Uint8Array {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Standard base64 encode */
function toBase64(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
}

/** Standard base64 decode */
function fromBase64(str: string): Uint8Array {
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export interface GeneratedKey {
	key: CryptoKey;
	/** Base64url-encoded key for embedding in URL fragment */
	exported: string;
}

export interface EncryptedPayload {
	/** Base64-encoded ciphertext (for server storage) */
	ciphertext_b64: string;
	/** Base64-encoded IV (for server storage) */
	iv_b64: string;
}

/** Generate a new AES-256-GCM key and export it as base64url. */
export async function generateKey(): Promise<GeneratedKey> {
	const key = await crypto.subtle.generateKey({ name: ALGO, length: KEY_LENGTH }, true, [
		'encrypt',
		'decrypt'
	]);
	const raw = await crypto.subtle.exportKey('raw', key);
	return { key, exported: toBase64Url(raw) };
}

/** Import a base64url-encoded key string back into a CryptoKey. */
export async function importKey(base64urlKey: string): Promise<CryptoKey> {
	const raw = fromBase64Url(base64urlKey);
	return crypto.subtle.importKey('raw', raw as BufferSource, { name: ALGO, length: KEY_LENGTH }, false, [
		'decrypt'
	]);
}

/** Encrypt plaintext with the given key. Returns base64-encoded ciphertext + IV. */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv: iv as BufferSource }, key, encoded);
	return {
		ciphertext_b64: toBase64(ciphertext),
		iv_b64: toBase64(iv)
	};
}

/** Decrypt base64-encoded ciphertext + IV with the given key. */
export async function decrypt(
	ciphertext_b64: string,
	iv_b64: string,
	key: CryptoKey
): Promise<string> {
	const ciphertext = fromBase64(ciphertext_b64);
	const iv = fromBase64(iv_b64);
	const plaintext = await crypto.subtle.decrypt({ name: ALGO, iv: iv as BufferSource }, key, ciphertext as BufferSource);
	return new TextDecoder().decode(plaintext);
}

/** What a share link carries in its #fragment. Neither part ever reaches a server. */
export interface ShareFragment {
	/** The recipient's token. */
	token: string | null;
	/** The base64url AES key. */
	key: string | null;
}

const FRAGMENT_VALUE = /^[A-Za-z0-9_-]+$/;

/** Build a recipient's link: the token and the key both live in the fragment. */
export function buildShareLink(origin: string, token: string, key: string): string {
	const base = origin.replace(/\/+$/, '');
	return `${base}/view#t=${encodeURIComponent(token)}&key=${encodeURIComponent(key)}`;
}

/** Read `#t=…&key=…`. Anything malformed reads as null. */
export function parseShareFragment(hash: string): ShareFragment {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	const pick = (name: string): string | null => {
		const value = params.get(name)?.trim() ?? '';
		return FRAGMENT_VALUE.test(value) ? value : null;
	};
	return { token: pick('t'), key: pick('key') };
}
