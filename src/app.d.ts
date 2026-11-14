import type { Lang } from '$lib/i18n';

declare global {
	namespace App {
		interface Locals {
			/** The signed-in creator's email, or null. */
			creator: string | null;
			lang: Lang;
			/** FULLA_DEMO=true: the public demo. */
			demo: boolean;
		}
		interface Error {
			message: string;
		}
	}
}

export {};
