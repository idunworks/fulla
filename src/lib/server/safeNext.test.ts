import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext';

describe('safeNext', () => {
	it.each([
		['/admin', '/admin'],
		['/admin/abc?x=1', '/admin/abc?x=1'],
		['/admin#top', '/admin#top'],
		['  /padded  ', '/padded'],
		['/a/../b', '/b']
	])('keeps the same-site path %j', (value, expected) => {
		expect(safeNext(value, '/home')).toBe(expected);
	});

	it.each([
		'//evil.example',
		'/\\evil.example',
		'/\\/evil.example',
		'https://evil.example',
		'javascript:alert(1)',
		'',
		// Browsers strip tab, CR and LF while parsing: these all become //evil.example.
		'/\t/evil.example',
		'/\n/evil.example',
		'/\r/evil.example',
		'/\u0000/evil.example',
		'/\u007f/evil.example'
	])('falls back for %j', (value) => {
		expect(safeNext(value, '/home')).toBe('/home');
	});

	it('falls back for ?next=/%09/evil.example once the query is decoded', () => {
		const next = new URL('https://site.example/auth?next=/%09/evil.example').searchParams.get('next');
		expect(safeNext(next, '/home')).toBe('/home');
	});

	it('keeps an encoded slash as a harmless path, never a host', () => {
		const out = safeNext('/%2F%2Fevil.example', '/home');
		expect(new URL(out, 'https://site.example').host).toBe('site.example');
	});

	it('defaults to /admin, and ignores what is not a string', () => {
		expect(safeNext(null)).toBe('/admin');
		expect(safeNext({ toString: () => '//evil.example' })).toBe('/admin');
	});
});

describe('safeNext under a base path', () => {
	const BASE = '/fulla-demo';
	it('keeps paths under the base', () => {
		expect(safeNext('/fulla-demo/admin/new', `${BASE}/admin`, BASE)).toBe('/fulla-demo/admin/new');
		expect(safeNext('/fulla-demo', `${BASE}/admin`, BASE)).toBe('/fulla-demo');
	});
	it('refuses the rest of the host, and look-alike prefixes', () => {
		expect(safeNext('/admin', `${BASE}/admin`, BASE)).toBe('/fulla-demo/admin');
		expect(safeNext('/fulla-demo-evil/x', `${BASE}/admin`, BASE)).toBe('/fulla-demo/admin');
		expect(safeNext('/fulla-demo/../admin', `${BASE}/admin`, BASE)).toBe('/fulla-demo/admin');
	});
});
