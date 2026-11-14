import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { safeNext } from '$lib/server/safeNext';

/** Already signed in: nothing to do here. */
export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.creator) redirect(303, safeNext(url.searchParams.get('next'), `${base}/admin`, base));
};
