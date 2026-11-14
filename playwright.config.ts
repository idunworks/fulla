import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the production build, on a fresh database each run.
 * Sign-in emails go to the console mailer, which writes them to
 * e2e-data/server.log; the tests read their links from there.
 *
 * Run: pnpm build && pnpm test:e2e
 */
const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	// One worker, in file order: the sign-in rate limit counts every request from 127.0.0.1.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		...devices['Desktop Chrome']
	},
	webServer: {
		command: 'rm -rf e2e-data && mkdir e2e-data && node build 2>&1 | tee e2e-data/server.log',
		url: `http://localhost:${PORT}/`,
		reuseExistingServer: false,
		env: {
			PORT: String(PORT),
			ORIGIN: `http://localhost:${PORT}`,
			FULLA_DATABASE: 'e2e-data/fulla.db',
			FULLA_ALLOWED_EMAILS: 'creator@example.com,@team.example',
			FULLA_MAIL_CONSOLE: 'true'
		}
	}
});
