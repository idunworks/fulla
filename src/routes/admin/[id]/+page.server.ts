import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireCreator } from '$lib/server/guard';
import { getDb } from '$lib/server/instance';
import { FullaError, getSecret } from '$lib/server/secrets';

export const load: PageServerLoad = (event) => {
	const creator = requireCreator(event);
	try {
		return { secret: getSecret(getDb(), creator, event.params.id, Date.now()) };
	} catch (err) {
		if (err instanceof FullaError && err.status === 404) error(404, 'Not found');
		throw err;
	}
};
