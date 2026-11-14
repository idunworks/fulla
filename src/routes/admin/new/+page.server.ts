import type { PageServerLoad } from './$types';
import { requireCreator } from '$lib/server/guard';
import { LIMITS } from '$lib/server/secrets';

export const load: PageServerLoad = (event) => {
	requireCreator(event);
	return { maxRecipients: LIMITS.maxRecipients };
};
