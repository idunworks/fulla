import { redirect } from '@sveltejs/kit';

/**
 * The signed-in creator, or a redirect to sign in (and back here afterwards).
 * Every /admin load calls it itself: Kit runs a page's load alongside its
 * layout's, so a check in the layout alone wouldn't stop the page's query.
 */
export function requireCreator({ locals, url }: { locals: App.Locals; url: URL }): string {
	if (!locals.creator) redirect(303, `/auth?next=${encodeURIComponent(url.pathname + url.search)}`);
	return locals.creator;
}
