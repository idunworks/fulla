/**
 * The creator's session cookie.
 *
 * Over HTTPS it is named __Host-fulla_session: browsers accept that prefix only
 * on a Secure cookie for the whole site with no Domain, so nothing on a
 * sibling subdomain can set or overwrite it. Plain-HTTP localhost gets the
 * bare name, since a Secure cookie wouldn't stick there.
 *
 * Under a base path (FULLA_BASE_PATH) the host may belong to another site too,
 * so the cookie is scoped to that path instead. __Host- requires Path=/, so
 * it becomes __Secure-fulla_session, Path=<base>: the rest of the host never
 * receives it.
 *
 * SameSite=Strict: a page on another site can't make a request that carries it.
 */
import { base } from '$app/paths';
import type { Cookies } from '@sveltejs/kit';

/** Name and path of the session cookie, for this protocol and base path. */
export function cookieSpec(url: URL, basePath: string = base): { name: string; path: string } {
	const https = url.protocol === 'https:';
	if (!basePath) return { name: https ? '__Host-fulla_session' : 'fulla_session', path: '/' };
	return { name: https ? '__Secure-fulla_session' : 'fulla_session', path: basePath };
}

function cookieName(url: URL): string {
	return cookieSpec(url).name;
}

export function readSessionCookie(cookies: Cookies, url: URL): string | undefined {
	return cookies.get(cookieName(url));
}

export function setSessionCookie(cookies: Cookies, url: URL, id: string, expiresAt: number): void {
	cookies.set(cookieName(url), id, {
		path: cookieSpec(url).path,
		httpOnly: true,
		sameSite: 'strict',
		secure: url.protocol === 'https:',
		expires: new Date(expiresAt)
	});
}

export function clearSessionCookie(cookies: Cookies, url: URL): void {
	cookies.delete(cookieName(url), { path: cookieSpec(url).path, secure: url.protocol === 'https:' });
}
