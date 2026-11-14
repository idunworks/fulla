import { defineConfig, devices } from '@playwright/test';

/**
 * The public demo, end to end: built under a base path (/fulla-demo) with
 * FULLA_DEMO=true, the way idunworks.com/fulla-demo runs it.
 *
 * Run: pnpm test:e2e:demo   (builds into build-demo/ first)
 */
const PORT = 4174;

export default defineConfig({
	testDir: 'tests/e2e-demo',
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
		command: 'rm -rf e2e-demo-data && mkdir e2e-demo-data && node build-demo',
		url: `http://localhost:${PORT}/fulla-demo/`,
		reuseExistingServer: false,
		env: {
			PORT: String(PORT),
			ORIGIN: `http://localhost:${PORT}`,
			FULLA_DATABASE: 'e2e-demo-data/fulla.db',
			FULLA_DEMO: 'true'
		}
	}
});
