/**
 * Where to send a creator after sign-in, limited to this site.
 *
 * A string check alone is not enough: browsers strip ASCII tab, CR and LF
 * while parsing a URL, so "/\t/evil.example" passes "the second character is
 * not a slash" and still lands on //evil.example. Control characters are
 * refused outright, then the URL parser decides the origin.
 */
const PROBE_ORIGIN = 'http://same-origin.invalid';
// C0 controls and DEL. Leading and trailing spaces are trimmed first.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * A same-origin path (with its query and hash), or `fallback`. With a `base`
 * (FULLA_BASE_PATH), the path must also lie under it: Fulla may share its
 * host with another site, and sign-in should never send anyone there.
 */
export function safeNext(value: unknown, fallback = '/admin', base = ''): string {
	const v = String(value ?? '').trim();
	if (!v.startsWith('/') || CONTROL_CHARS.test(v)) return fallback;
	let url: URL;
	try {
		url = new URL(v, PROBE_ORIGIN);
	} catch {
		return fallback;
	}
	if (url.origin !== PROBE_ORIGIN) return fallback;
	if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return fallback;
	return `${url.pathname}${url.search}${url.hash}`;
}
