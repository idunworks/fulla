import { describe, expect, it } from 'vitest';
import {
	buildShareLink,
	decrypt,
	encrypt,
	generateKey,
	importKey,
	parseShareFragment
} from './crypto';

describe('crypto', () => {
	it('round-trips text through the exported key', async () => {
		const { key, exported } = await generateKey();
		const sealed = await encrypt('hunter2 · lösenord ✓', key);
		const opened = await decrypt(sealed.ciphertext_b64, sealed.iv_b64, await importKey(exported));
		expect(opened).toBe('hunter2 · lösenord ✓');
	});

	it('uses a fresh IV every time', async () => {
		const { key } = await generateKey();
		const a = await encrypt('same', key);
		const b = await encrypt('same', key);
		expect(a.iv_b64).not.toBe(b.iv_b64);
		expect(a.ciphertext_b64).not.toBe(b.ciphertext_b64);
	});

	it('refuses the wrong key', async () => {
		const right = await generateKey();
		const wrong = await generateKey();
		const sealed = await encrypt('secret', right.key);
		await expect(
			decrypt(sealed.ciphertext_b64, sealed.iv_b64, await importKey(wrong.exported))
		).rejects.toThrow();
	});

	it('refuses tampered ciphertext (GCM tag)', async () => {
		const { key, exported } = await generateKey();
		const sealed = await encrypt('secret', key);
		const bytes = Uint8Array.from(atob(sealed.ciphertext_b64), (c) => c.charCodeAt(0));
		bytes[0] ^= 1;
		const tampered = btoa(String.fromCharCode(...bytes));
		await expect(decrypt(tampered, sealed.iv_b64, await importKey(exported))).rejects.toThrow();
	});

	it('exports a 256-bit key as unpadded base64url', async () => {
		const { exported } = await generateKey();
		expect(exported).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});
});

describe('share links', () => {
	it('puts token and key in the fragment, nothing in the path', () => {
		const link = buildShareLink('https://example.com/', 'tok_EN-123', 'key_ABC-xyz');
		const url = new URL(link);
		expect(url.pathname).toBe('/view');
		expect(url.search).toBe('');
		expect(parseShareFragment(url.hash)).toEqual({ token: 'tok_EN-123', key: 'key_ABC-xyz' });
	});

	it('treats malformed values as missing', () => {
		expect(parseShareFragment('#t=<script>&key=a b')).toEqual({ token: null, key: null });
		expect(parseShareFragment('')).toEqual({ token: null, key: null });
		expect(parseShareFragment('#t=&key=')).toEqual({ token: null, key: null });
	});
});
