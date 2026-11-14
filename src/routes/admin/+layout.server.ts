import type { LayoutServerLoad } from './$types';
import { requireCreator } from '$lib/server/guard';

/** Everything under /admin is the signed-in creator's. */
export const load: LayoutServerLoad = (event) => ({ creator: requireCreator(event) });
