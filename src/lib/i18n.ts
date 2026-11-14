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
	badKey: 'The secret could not be decrypted: the key in the link does not match. Ask the sender for a new link.',
	// Sign-in
	signInTitle: 'Sign in to share a secret',
	signInBody: 'Enter your email address. If it may use this Fulla, you get a link that signs you in.',
	emailLabel: 'Email address',
	sendLink: 'Send sign-in link',
	sending: 'Sending…',
	badEmail: 'Enter a valid email address.',
	linkSentTitle: 'Check your inbox',
	linkSentBody: 'If this address may sign in, a link is on its way. It works once, within 15 minutes.',
	otherAddress: 'Use another address',
	signInReadyTitle: 'One click and you are in',
	signInReadyBody: 'Press the button to sign in on this device.',
	signIn: 'Sign in',
	signingIn: 'Signing in…',
	signInFailedTitle: 'That link did not work',
	signInFailedBody: 'It has already been used or has expired. Ask for a new one.',
	askNewLink: 'Ask for a new link',
	mailSubject: 'Your sign-in link for Fulla',
	mailBody:
		'Sign in to Fulla with this link:\n\n{link}\n\nIt works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.',

	// Creator's pages
	yourSecrets: 'Your secrets',
	newSecret: 'New secret',
	signOut: 'Sign out',
	signedInAs: 'Signed in as {email}',
	backToList: 'Back to your secrets',
	listEmpty: 'No secrets yet.',
	listEmptyHint: 'Create one, and each recipient gets their own link.',
	revealedOf: '{revealed} of {total} revealed',
	status_active: 'Active',
	status_expired: 'Expired',
	status_burned: 'Seen by all',
	status_revoked: 'Revoked',
	expiresOn: 'Expires {date}',
	expiredOn: 'Expired {date}',
	createdOn: 'Created {date}',

	newTitle: 'Share a secret',
	newIntro:
		'Each recipient gets their own link, which shows the secret once. When everyone has seen it, or it expires, it is gone.',
	labelLabel: 'Title',
	labelHint: 'Only you see it, but it is stored unencrypted: never put the secret itself here.',
	secretLabel: 'Secret',
	secretHint: 'Encrypted in your browser before it is sent. The server never sees it.',
	recipientsLabel: 'Recipients',
	recipientsHint: 'One link per person. The email is only a note for your list: Fulla sends nothing to it.',
	recipientsHintDemo: 'One link per person, each shown once. Up to 3 in the demo.',
	recipientName: 'Name',
	recipientEmail: 'Email (optional)',
	addRecipient: 'Add recipient',
	removeRecipient: 'Remove {name}',
	expiresLabel: 'The links expire after',
	hours_1: '1 hour',
	hours_4: '4 hours',
	hours_24: '24 hours',
	hours_72: '3 days',
	hours_168: '1 week',
	minutes_10: '10 minutes',
	demoBanner: "Demo: don't paste real secrets. Everything is deleted within 10 minutes.",
	demoTitle: 'Try Fulla',
	demoBody: "No account and no email: you play both sides. Create a secret, then open the recipient's link in a new tab.",
	demoStart: 'Start the demo',
	demoStarting: 'Starting…',
	demoSession: 'Demo session',
	tryDemo: 'Try the demo',
	openAsRecipient: 'Open as recipient',
	create: 'Encrypt and create links',
	creating: 'Encrypting…',
	needLabel: 'Give it a title.',
	needSecret: 'Write the secret first.',
	needRecipient: 'Add at least one recipient, with a name.',
	tooManyRecipients: 'At most {max} recipients.',
	createFailed: 'The secret could not be saved: {detail}',
	linksTitle: 'Copy these links now',
	linksBody:
		"Each link carries the key and the recipient's own code, and the server keeps neither. Once you leave this page, the links cannot be shown again.",
	copyLink: 'Copy link',
	copyAll: 'Copy all links',
	done: 'Done',

	notOpened: 'Not opened yet',
	openedOn: 'Opened {date}',
	revealedOn: 'Revealed {date}',
	revoke: 'Revoke',
	revokeBody: 'Every link stops working and the encrypted data is deleted.',
	revokeConfirm: 'Revoke for everyone',
	revokeCancel: 'Keep it',
	revokeFailed: 'Could not revoke it. Try again.',
	secretGone: 'The encrypted data has been deleted. Only this record is left, and it goes 30 days later.'
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
	badKey: 'Hemligheten kunde inte dekrypteras: nyckeln i länken stämmer inte. Be avsändaren om en ny länk.',
	// Inloggning
	signInTitle: 'Logga in för att dela en hemlighet',
	signInBody: 'Skriv din e-postadress. Får adressen använda Fulla här, får du en länk som loggar in dig.',
	emailLabel: 'E-postadress',
	sendLink: 'Skicka inloggningslänk',
	sending: 'Skickar…',
	badEmail: 'Skriv en giltig e-postadress.',
	linkSentTitle: 'Titta i inkorgen',
	linkSentBody: 'Får adressen logga in är en länk på väg. Den fungerar en gång, inom 15 minuter.',
	otherAddress: 'Använd en annan adress',
	signInReadyTitle: 'Ett klick så är du inne',
	signInReadyBody: 'Klicka på knappen för att logga in på den här enheten.',
	signIn: 'Logga in',
	signingIn: 'Loggar in…',
	signInFailedTitle: 'Länken fungerade inte',
	signInFailedBody: 'Den är redan använd eller har gått ut. Be om en ny.',
	askNewLink: 'Be om en ny länk',
	mailSubject: 'Din inloggningslänk till Fulla',
	mailBody:
		'Logga in i Fulla med den här länken:\n\n{link}\n\nDen fungerar en gång och går ut om 15 minuter. Bad du inte om den kan du strunta i det här mejlet.',

	// Avsändarens sidor
	yourSecrets: 'Dina hemligheter',
	newSecret: 'Ny hemlighet',
	signOut: 'Logga ut',
	signedInAs: 'Inloggad som {email}',
	backToList: 'Tillbaka till dina hemligheter',
	listEmpty: 'Inga hemligheter än.',
	listEmptyHint: 'Skapa en, så får varje mottagare en egen länk.',
	revealedOf: '{revealed} av {total} har visat',
	status_active: 'Aktiv',
	status_expired: 'Utgången',
	status_burned: 'Sedd av alla',
	status_revoked: 'Återkallad',
	expiresOn: 'Går ut {date}',
	expiredOn: 'Gick ut {date}',
	createdOn: 'Skapad {date}',

	newTitle: 'Dela en hemlighet',
	newIntro:
		'Varje mottagare får en egen länk som visar hemligheten en gång. När alla har sett den, eller tiden har gått ut, är den borta.',
	labelLabel: 'Rubrik',
	labelHint: 'Bara du ser den, men den sparas okrypterad: skriv aldrig själva hemligheten här.',
	secretLabel: 'Hemlighet',
	secretHint: 'Krypteras i din webbläsare innan den skickas. Servern ser den aldrig.',
	recipientsLabel: 'Mottagare',
	recipientsHint: 'En länk per person. E-posten är bara en anteckning i din lista: Fulla skickar inget dit.',
	recipientsHintDemo: 'En länk per person, som visas en gång. Upp till 3 i demon.',
	recipientName: 'Namn',
	recipientEmail: 'E-post (frivilligt)',
	addRecipient: 'Lägg till mottagare',
	removeRecipient: 'Ta bort {name}',
	expiresLabel: 'Länkarna går ut efter',
	hours_1: '1 timme',
	hours_4: '4 timmar',
	hours_24: '24 timmar',
	hours_72: '3 dagar',
	hours_168: '1 vecka',
	minutes_10: '10 minuter',
	demoBanner: 'Demo: klistra inte in riktiga hemligheter. Allt raderas inom 10 minuter.',
	demoTitle: 'Prova Fulla',
	demoBody: 'Inget konto och ingen e-post: du spelar båda rollerna. Skapa en hemlighet och öppna sedan mottagarens länk i en ny flik.',
	demoStart: 'Starta demon',
	demoStarting: 'Startar…',
	demoSession: 'Demosession',
	tryDemo: 'Prova demon',
	openAsRecipient: 'Öppna som mottagare',
	create: 'Kryptera och skapa länkar',
	creating: 'Krypterar…',
	needLabel: 'Ge den en rubrik.',
	needSecret: 'Skriv hemligheten först.',
	needRecipient: 'Lägg till minst en mottagare, med namn.',
	tooManyRecipients: 'Högst {max} mottagare.',
	createFailed: 'Hemligheten kunde inte sparas: {detail}',
	linksTitle: 'Kopiera länkarna nu',
	linksBody:
		'Varje länk bär nyckeln och mottagarens egen kod, och servern sparar ingen av dem. När du lämnar sidan går länkarna inte att visa igen.',
	copyLink: 'Kopiera länk',
	copyAll: 'Kopiera alla länkar',
	done: 'Klar',

	notOpened: 'Inte öppnad än',
	openedOn: 'Öppnad {date}',
	revealedOn: 'Visad {date}',
	revoke: 'Återkalla',
	revokeBody: 'Alla länkar slutar fungera och den krypterade datan raderas.',
	revokeConfirm: 'Återkalla för alla',
	revokeCancel: 'Behåll den',
	revokeFailed: 'Det gick inte att återkalla. Försök igen.',
	secretGone: 'Den krypterade datan är raderad. Bara den här posten finns kvar, och den försvinner 30 dagar senare.'
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
