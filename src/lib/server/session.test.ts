import { describe, expect, it } from 'vitest';
import { cookieSpec } from './session';

const HTTPS = new URL('https://fulla.example/admin');
const HTTP = new URL('http://localhost:5173/admin');

describe('the session cookie', () => {
	it('is __Host- for the whole host when Fulla has the host to itself', () => {
		expect(cookieSpec(HTTPS, '')).toEqual({ name: '__Host-fulla_session', path: '/' });
		expect(cookieSpec(HTTP, '')).toEqual({ name: 'fulla_session', path: '/' });
	});

	it('is scoped to the base path when the host is shared', () => {
		expect(cookieSpec(HTTPS, '/fulla-demo')).toEqual({ name: '__Secure-fulla_session', path: '/fulla-demo' });
		expect(cookieSpec(HTTP, '/fulla-demo')).toEqual({ name: 'fulla_session', path: '/fulla-demo' });
	});
});
