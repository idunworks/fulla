import type { PageServerLoad } from './$types';
import { requireCreator } from '$lib/server/guard';
import { getDb } from '$lib/server/instance';
import { listSecrets } from '$lib/server/secrets';

export const load: PageServerLoad = (event) => ({
	secrets: listSecrets(getDb(), requireCreator(event), Date.now())
});
