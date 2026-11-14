import { expect, test } from '@playwright/test';

const ORIGIN = 'http://localhost:4174';
const BASE = `${ORIGIN}/fulla-demo`;
const SECRET = 'demo-pw: correct horse battery staple';

function post(path: string, body: unknown): Promise<Response> {
	return fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

test('a visitor plays both sides: create, open as recipient in a new tab, reveal once', async ({ page, context }) => {
	const cspErrors: string[] = [];
	context.on('console', (m) => {
		if (/Content Security Policy|Refused to/.test(m.text())) cspErrors.push(m.text());
	});

	await page.goto('/fulla-demo/');
	await expect(page.getByRole('note')).toContainText("don't paste real secrets");
	await page.getByRole('link', { name: 'Try the demo' }).click();
	await page.getByRole('button', { name: 'Start the demo' }).click();
	await page.waitForURL(`${BASE}/admin/new`);
	await expect(page.getByText('Demo session')).toBeVisible();

	// The session cookie stays under the base path.
	const [cookie] = await context.cookies();
	expect(cookie.name).toBe('fulla_session');
	expect(cookie.path).toBe('/fulla-demo');
	expect(cookie.httpOnly).toBe(true);

	// Demo form: no email fields, one lifetime.
	await expect(page.getByLabel('Email (optional)')).toHaveCount(0);
	await expect(page.locator('#expires option')).toHaveText(['10 minutes']);

	await page.getByLabel('Title').fill('Try it');
	await page.getByLabel('Secret').fill(SECRET);
	await page.getByLabel('Name').first().fill('Anna');
	await page.getByRole('button', { name: 'Encrypt and create links' }).click();
	await expect(page.getByText('Copy these links now')).toBeVisible();
	const link = (await page.locator('code.link-url').first().textContent()) ?? '';
	expect(link.startsWith(`${BASE}/view#t=`)).toBe(true);

	const [recipient] = await Promise.all([
		context.waitForEvent('page'),
		page.getByRole('link', { name: 'Open as recipient' }).click()
	]);
	await recipient.waitForLoadState();
	await recipient.getByRole('button', { name: 'Show secret' }).click();
	await expect(recipient.locator('pre')).toHaveText(SECRET);

	const again = await context.newPage();
	await again.goto(link);
	await expect(again.getByRole('heading', { name: 'This link has already been used' })).toBeVisible();

	// The creator sees it, under the base path.
	await page.getByRole('link', { name: 'Done' }).click();
	await page.waitForURL(`${BASE}/admin`);
	await page.getByRole('link', { name: /Try it/ }).click();
	await expect(page.getByText(/Revealed/).first()).toBeVisible();
	expect(cspErrors).toEqual([]);
});

test('the demo has no email sign-in, refuses big or long-lived secrets, and asks not to be indexed', async () => {
	expect((await post('/api/auth/link', { email: 'a@example.com' })).status).toBe(404);
	expect((await post('/api/auth/verify', { token: 'x' })).status).toBe(404);

	const home = await fetch(`${BASE}/`);
	expect(home.headers.get('x-robots-tag')).toContain('noindex');
	expect((await fetch(`${BASE}/view`)).headers.get('cache-control')).toBe('no-store');

	// Outside the base path there is nothing.
	expect((await fetch(`${ORIGIN}/admin`)).status).toBe(404);

	const start = await post('/api/auth/demo', {});
	expect(start.status).toBe(201);
	const cookie = (start.headers.get('set-cookie') ?? '').split(';')[0];
	const create = (expiresInMin: number) =>
		fetch(`${BASE}/api/secrets`, {
			method: 'POST',
			headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				label: 'x',
				ciphertext_b64: 'AAAA',
				iv_b64: Buffer.alloc(12).toString('base64'),
				expires_at: new Date(Date.now() + expiresInMin * 60_000).toISOString(),
				recipients: [{ label: 'a' }]
			})
		});
	expect((await create(60)).status).toBe(400);
	expect((await create(10)).status).toBe(201);
});
