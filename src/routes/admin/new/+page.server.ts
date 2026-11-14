import type { PageServerLoad } from './$types';
import { limits } from '$lib/server/config';
import { requireCreator } from '$lib/server/guard';

/** The lifetimes the form offers, in minutes. The server enforces the same limits. */
const LIFETIMES_MIN = [60, 240, 1440, 4320, 10080];

export const load: PageServerLoad = (event) => {
	requireCreator(event);
	const rules = limits();
	const maxMinutes = rules.maxLifetimeMs / 60_000;
	const lifetimes = LIFETIMES_MIN.filter((m) => m <= maxMinutes);
	return {
		maxRecipients: rules.maxRecipients,
		lifetimes: lifetimes.length > 0 ? lifetimes : [maxMinutes],
		askEmails: rules.keepEmails
	};
};
