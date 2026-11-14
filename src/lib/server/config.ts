/**
 * Everything Fulla reads from its environment, read in one place.
 * See config.example.env for every setting.
 */
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { parseAllowlist, type Allowlist } from './auth';
import { createMailer, type Mailer } from './mailer';
import { DEMO_LIMITS, LIMITS, type Limits } from './secrets';

/** FULLA_DEMO=true: the public demo. No sign-in email, small and short-lived secrets. */
export function demoMode(): boolean {
	return env.FULLA_DEMO === 'true';
}

/** The rules secrets are held to on this instance. */
export function limits(): Limits {
	return demoMode() ? DEMO_LIMITS : LIMITS;
}

let cachedList: { raw: string; list: Allowlist } | null = null;

/** FULLA_ALLOWED_EMAILS, parsed once per value. */
export function allowlist(): Allowlist {
	const raw = env.FULLA_ALLOWED_EMAILS ?? '';
	if (cachedList?.raw !== raw) cachedList = { raw, list: parseAllowlist(raw) };
	return cachedList.list;
}

/**
 * The address sign-in links point to. In production it must come from ORIGIN
 * (adapter-node's own setting), never from the request: otherwise anyone
 * could ask for a link with a forged Host header and have the creator's
 * email point at their server. Null when it isn't set.
 */
export function publicOrigin(requestOrigin: string): string | null {
	const configured = env.ORIGIN?.trim();
	if (configured) return new URL(configured).origin;
	return dev ? requestOrigin : null;
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
	if (!mailer) {
		mailer = createMailer({
			smtpUrl: env.FULLA_SMTP_URL?.trim() || undefined,
			from: env.FULLA_MAIL_FROM?.trim() || undefined,
			console: env.FULLA_MAIL_CONSOLE === 'true' || (dev && !env.FULLA_SMTP_URL)
		});
	}
	return mailer;
}
