/**
 * Every visible text, in English and Swedish. The language comes from the
 * visitor's browser (Accept-Language); FULLA_LANG pins one for the whole site.
 */
export const LANGS = ['en', 'sv'] as const;
export type Lang = (typeof LANGS)[number];

const en = {
	tagline: 'Encrypted secret sharing',
	footer: 'Encrypted in your browser. The server never sees the plain text.',

	helpTitle: 'How does this work?',
	helpWhat: 'This link comes from Fulla, a tool for sharing passwords and other secrets safely.',
	helpOnce:
		'Press Show secret and copy what you see straight away. The link works once: after the secret has been shown, it cannot be opened again. If it is a password, you can let your browser save it.',
	helpExpiry: 'The link also expires after a while, at most a week.',
	helpTechTitle: 'The technical part (if you are curious)',
	helpTech:
		'The encryption (AES-256-GCM) happens in the browser. The server stores only the encrypted data and has never seen the secret itself. The key is in the part of the link after the #, which browsers never send to a server. Only someone with the whole link can decrypt it. When every recipient has seen the secret, or the time is up, the encrypted data is deleted from the server.',

	checking: 'Checking the link…',
	decrypting: 'Decrypting…',
	readyTitle: 'Someone has shared a secret with you',
	readyBody: 'It can be shown once. Have somewhere ready to paste it before you press the button.',
	expires: 'The link expires {date}.',
	show: 'Show secret',
	revealedTitle: 'Your secret',
	copy: 'Copy to clipboard',
	copied: 'Copied',
	saveNow: 'Save it now.',
	spent: 'The link is used up: once you leave this page, the secret cannot be shown again.',

	usedTitle: 'This link has already been used',
	usedBody: 'The secret has already been shown through this link. If you need it again, ask the sender for a new link.',
	goneTitle: 'This secret no longer exists',
	goneBody: 'It has expired, been revoked, or been deleted after every recipient saw it.',
	invalidTitle: 'This link is not valid',
	invalidBody: 'The link is incomplete or unknown. Check that you copied all of it, including everything after the #.',
	errorTitle: 'The secret cannot be shown',
	tooMany: 'Too many attempts right now. Wait a few minutes and try again.',
	failed: 'Something went wrong while opening the link. Try again in a moment.',
	badKey: 'The secret could not be decrypted: the key in the link does not match. Ask the sender for a new link.'
};

export type Messages = typeof en;

const sv: Messages = {
	tagline: 'Krypterad delning av hemligheter',
	footer: 'Krypterad i din webbläsare. Servern ser aldrig klartexten.',

	helpTitle: 'Hur funkar det här?',
	helpWhat:
		'Den här länken kommer från Fulla, ett verktyg för att dela lösenord och andra hemligheter på ett säkert sätt.',
	helpOnce:
		'Klicka på Visa hemlighet och kopiera innehållet direkt. Länken fungerar bara en gång: när hemligheten har visats går den inte att öppna igen. Är det ett lösenord kan du låta webbläsaren spara det.',
	helpExpiry: 'Länken går också ut efter en viss tid, högst en vecka.',
	helpTechTitle: 'Tekniskt (om någon undrar)',
	helpTech:
		'Krypteringen (AES-256-GCM) sker i webbläsaren. Servern lagrar bara den krypterade datan och har aldrig sett hemligheten i klartext. Nyckeln finns i länkens del efter #, som webbläsare aldrig skickar till servern. Bara den som har hela länken kan dekryptera. När alla mottagare har visat hemligheten, eller tiden har gått ut, raderas den krypterade datan från servern.',

	checking: 'Kontrollerar länken…',
	decrypting: 'Dekrypterar…',
	readyTitle: 'Någon har delat en hemlighet med dig',
	readyBody: 'Den kan visas en gång. Ha något redo att klistra in den i innan du klickar.',
	expires: 'Länken går ut {date}.',
	show: 'Visa hemlighet',
	revealedTitle: 'Din hemlighet',
	copy: 'Kopiera till urklipp',
	copied: 'Kopierad',
	saveNow: 'Spara den nu.',
	spent: 'Länken är förbrukad: lämnar du sidan går hemligheten inte att visa igen.',

	usedTitle: 'Länken är redan använd',
	usedBody: 'Hemligheten har redan visats via den här länken. Behöver du den igen, be avsändaren om en ny länk.',
	goneTitle: 'Hemligheten finns inte längre',
	goneBody: 'Den har gått ut, återkallats eller raderats efter att alla mottagare har sett den.',
	invalidTitle: 'Ogiltig länk',
	invalidBody: 'Länken är ofullständig eller okänd. Kontrollera att du kopierade hela länken, med allt efter #.',
	errorTitle: 'Kan inte visa hemligheten',
	tooMany: 'För många försök just nu. Vänta några minuter och försök igen.',
	failed: 'Något gick fel när länken skulle öppnas. Försök igen om en stund.',
	badKey: 'Hemligheten kunde inte dekrypteras: nyckeln i länken stämmer inte. Be avsändaren om en ny länk.'
};

const MESSAGES: Record<Lang, Messages> = { en, sv };

export function messages(lang: Lang): Messages {
	return MESSAGES[lang];
}

export function isLang(value: unknown): value is Lang {
	return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** The first supported language in an Accept-Language header, else English. */
export function pickLang(acceptLanguage: string | null, pinned?: string): Lang {
	if (isLang(pinned)) return pinned;
	const wanted = (acceptLanguage ?? '')
		.split(',')
		.map((part) => {
			const [tag, ...params] = part.trim().toLowerCase().split(';');
			const q = params.find((p) => p.trim().startsWith('q='));
			return { base: tag.split('-')[0], q: q ? Number(q.trim().slice(2)) || 0 : 1 };
		})
		.filter((w) => w.base && w.q > 0)
		.sort((a, b) => b.q - a.q);
	return wanted.map((w) => w.base).find(isLang) ?? 'en';
}

/** Fill `{name}` placeholders. */
export function fill(template: string, values: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

/** A date in the visitor's language and time zone. Server times always carry a Z. */
export function formatDate(value: string | null, lang: Lang): string {
	if (!value) return '—';
	return new Date(value).toLocaleString(lang === 'sv' ? 'sv-SE' : 'en-GB', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});
}
