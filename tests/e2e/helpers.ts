import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

export const BASE = 'http://localhost:4173';

/** Every email the console mailer has written for `address`, oldest first. */
export function mailsTo(address: string): string[] {
	return readFileSync('e2e-data/server.log', 'utf8')
		.split('fulla: email to ')
		.filter((m) => m.startsWith(address));
}

/** The sign-in link in the newest email to `address`, waiting for it to arrive. */
export async function signInLink(address: string): Promise<string> {
	let link: string | undefined;
	await expect
		.poll(() => (link = mailsTo(address).at(-1)?.match(/http:\/\/\S+\/auth#token=[A-Za-z0-9_-]{43}/)?.[0]))
		.toBeTruthy();
	return link as string;
}

/** A JSON POST from this site's own origin, the way its pages send them. */
export function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
	return fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: { Origin: BASE, 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify(body)
	});
}

/** Sign in through the real pages: ask for a link, open it, press the button. */
export async function signIn(page: Page, address: string, next = '/admin'): Promise<void> {
	await page.goto(`/auth?next=${encodeURIComponent(next)}`);
	await page.getByLabel('Email address').fill(address);
	await page.getByRole('button', { name: 'Send sign-in link' }).click();
	await expect(page.getByText('Check your inbox')).toBeVisible();
	await page.goto(await signInLink(address));
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(`${BASE}${next}`);
}

/** Collect Content-Security-Policy complaints from every page in the context. */
export function watchCsp(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (m) => {
		if (/Content Security Policy|Refused to/.test(m.text())) errors.push(m.text());
	});
	return errors;
}
