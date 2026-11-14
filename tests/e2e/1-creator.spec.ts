import { expect, test } from '@playwright/test';
import { BASE, mailsTo, post, signInLink, watchCsp } from './helpers';

const SECRET = 'wifi: korv-med-mos 42 · åäö';

test.describe.configure({ mode: 'serial' });

test('asking for a sign-in link gives one answer for everyone', async () => {
	const stranger = await post('/api/auth/link', { email: 'stranger@example.com' });
	const allowed = await post('/api/auth/link', { email: 'Creator@Example.com', next: '/admin/new' });
	expect(stranger.status).toBe(202);
	expect(allowed.status).toBe(202);
	expect(await stranger.text()).toBe(await allowed.text());

	const link = await signInLink('creator@example.com');
	expect(link.startsWith(`${BASE}/auth#token=`)).toBe(true);
	expect(mailsTo('stranger@')).toHaveLength(0);
});

test('requests from elsewhere and nonsense are refused', async () => {
	const forged = await post('/api/auth/link', { email: 'x@team.example' }, { Origin: 'http://evil.example' });
	expect(forged.status).toBe(403);
	expect((await post('/api/auth/link', { email: 'not an address' })).status).toBe(400);
	expect((await post('/api/secrets', {})).status).toBe(401);
	expect((await fetch(`${BASE}/api/secrets`)).status).toBe(401);
});

test('a creator signs in, shares a secret, follows it and revokes it', async ({ page, browser, request }) => {
	const csp = watchCsp(page);

	await page.goto('/admin');
	await expect(page).toHaveURL(/\/auth\?next=%2Fadmin$/);

	// A mail scanner opening the link spends nothing.
	const link = await signInLink('creator@example.com');
	expect((await request.get(link)).ok()).toBe(true);

	await page.goto(link);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(`${BASE}/admin/new`);
	expect(page.url()).not.toContain('#');

	const cookie = (await page.context().cookies()).find((c) => c.name === 'fulla_session');
	expect(cookie?.httpOnly).toBe(true);
	expect(cookie?.sameSite).toBe('Strict');
	expect((await post('/api/auth/verify', { token: link.split('#token=')[1] })).status).toBe(400);

	// Create, for two people.
	await page.getByLabel('Title').fill('Office wifi');
	await page.getByLabel('Secret').fill(SECRET);
	await page.getByLabel('Name').first().fill('Anna');
	await page.getByLabel('Email (optional)').first().fill('anna@example.com');
	await page.getByRole('button', { name: '+ Add recipient' }).click();
	await page.getByLabel('Name').nth(1).fill('Bo');
	await page.getByRole('button', { name: 'Encrypt and create links' }).click();
	await expect(page.getByText('Copy these links now')).toBeVisible();
	const urls = await page.locator('code.link-url').allTextContents();
	expect(urls).toHaveLength(2);
	for (const url of urls) expect(url).toMatch(/\/view#t=[A-Za-z0-9_-]{43}&key=[A-Za-z0-9_-]+$/);

	// Anna reveals.
	const anna = await browser.newContext();
	const pa = await anna.newPage();
	await pa.goto(urls[0]);
	await pa.getByRole('button', { name: 'Show secret' }).click();
	await expect(pa.locator('pre')).toHaveText(SECRET);

	// The list and the detail page follow along, and never show a link again.
	await page.getByRole('link', { name: 'Done' }).click();
	await page.waitForURL(`${BASE}/admin`);
	const row = page.locator('a.row', { hasText: 'Office wifi' });
	await expect(row).toContainText('1 of 2 revealed');
	await row.click();
	await page.waitForURL(/\/admin\/[0-9a-f-]{36}$/);
	await expect(page.getByText('anna@example.com')).toBeVisible();
	await expect(page.getByText('Not opened yet')).toBeVisible();
	const html = await page.content();
	for (const url of urls) expect(html).not.toContain(url.split('t=')[1].split('&')[0]);

	// Revoke: Bo's link is dead.
	await page.getByRole('button', { name: 'Revoke', exact: true }).click();
	await page.getByRole('button', { name: 'Revoke for everyone' }).click();
	await expect(page.locator('.pill-revoked')).toBeVisible();
	const pb = await anna.newPage();
	await pb.goto(urls[1]);
	await expect(pb.getByText('This secret no longer exists')).toBeVisible();

	// Sign out ends the session on the server, not only in this browser.
	const stolen = await browser.newContext({ locale: 'sv-SE' });
	await stolen.addCookies([cookie!]);
	const ps = await stolen.newPage();
	await ps.goto('/admin');
	await expect(ps.getByRole('heading', { name: 'Dina hemligheter' })).toBeVisible();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await page.waitForURL(/\/auth/);
	expect((await stolen.request.get('/api/secrets')).status()).toBe(401);

	expect(csp).toEqual([]);
});
