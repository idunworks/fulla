import { expect, test, type Page } from '@playwright/test';
import { BASE, post, signIn, watchCsp } from './helpers';

const SECRET = 'router-pw: Tr0ub4dor&3 · åäö';
let links: string[] = [];

test.describe.configure({ mode: 'serial' });

async function share(page: Page): Promise<string[]> {
	await signIn(page, 'sender@team.example', '/admin/new');
	await page.getByLabel('Title').fill('Router');
	await page.getByLabel('Secret').fill(SECRET);
	await page.getByLabel('Name').first().fill('A');
	await page.getByRole('button', { name: '+ Add recipient' }).click();
	await page.getByLabel('Name').nth(1).fill('B');
	await page.getByRole('button', { name: 'Encrypt and create links' }).click();
	await expect(page.getByText('Copy these links now')).toBeVisible();
	return page.locator('code.link-url').allTextContents();
}

test('the view page sends the strict headers', async () => {
	const res = await fetch(`${BASE}/view`);
	const csp = res.headers.get('content-security-policy') ?? '';
	expect(csp).toContain("default-src 'self'");
	expect(csp).toContain("frame-ancestors 'none'");
	expect(csp).not.toContain('unsafe-inline');
	expect(res.headers.get('cache-control')).toBe('no-store');
	expect(res.headers.get('referrer-policy')).toBe('no-referrer');
	expect((await post('/api/reveal', { token: 'x' }, { 'Content-Type': 'text/plain' })).status).toBe(415);
});

test.describe('a recipient in Swedish', () => {
	test.use({ locale: 'sv-SE' });

	test('opens the link, presses the button and sees the secret once', async ({ page, browser, request }) => {
		links = await share(await (await browser.newContext({ locale: 'en-GB' })).newPage());
		const csp = watchCsp(page);
		const requests: string[] = [];
		page.on('request', (r) => requests.push(`${r.url()} ${r.postData() ?? ''}`));
		const key = links[0].split('key=')[1];
		const token = links[0].split('t=')[1].split('&')[0];

		// A scanner fetching the page spends nothing.
		expect((await request.get(links[0])).ok()).toBe(true);

		await page.goto(links[0]);
		await expect(page.getByRole('heading', { name: 'Någon har delat en hemlighet med dig' })).toBeVisible();
		expect(await page.getAttribute('html', 'lang')).toBe('sv');
		expect(page.url()).not.toContain('#');
		expect(requests.some((r) => r.includes('/api/reveal'))).toBe(false);

		await page.getByRole('button', { name: 'Visa hemlighet' }).click();
		await expect(page.locator('pre')).toHaveText(SECRET);
		expect(requests.some((r) => r.split(' ')[0].includes(token))).toBe(false);
		expect(requests.some((r) => r.includes(key))).toBe(false);

		const again = await page.context().newPage();
		await again.goto(links[0]);
		await expect(again.getByRole('heading', { name: 'Länken är redan använd' })).toBeVisible();
		expect(csp).toEqual([]);
	});
});

test('the last recipient wipes it, and a broken link says so', async ({ page }) => {
	await page.goto(links[1]);
	await page.getByRole('button', { name: 'Show secret' }).click();
	await expect(page.locator('pre')).toHaveText(SECRET);

	const first = await page.context().newPage();
	await first.goto(links[0]);
	await expect(first.getByRole('heading', { name: 'This link has already been used' })).toBeVisible();

	// Same tab, new fragment: the browser doesn't reload, the page must still notice.
	await page.goto('/view#t=nonsense&key=abc');
	await expect(page.getByRole('heading', { name: 'This link is not valid' })).toBeVisible();
});
