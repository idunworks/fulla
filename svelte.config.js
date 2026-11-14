import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * FULLA_BASE_PATH serves Fulla under a path, such as /fulla, instead of a
 * whole host. SvelteKit writes it into the build, so it is read at build time.
 */
const basePath = process.env.FULLA_BASE_PATH ?? '';
if (basePath !== '' && !/^(\/[a-z0-9][a-z0-9._-]*)+$/i.test(basePath)) {
	throw new Error(`FULLA_BASE_PATH must be empty or like /fulla (no trailing slash), not "${basePath}".`);
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: process.env.FULLA_BUILD_DIR ?? 'build' }),
		paths: { base: basePath },
		// Kit adds hashes for the few inline scripts it writes itself, so the
		// policy never needs 'unsafe-inline'.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self'],
				// SvelteKit's screen-reader route announcer carries one fixed inline style.
				// Only that exact attribute is allowed, by hash; app.css hides it too, so
				// if a Kit update changes the text, the cost is a console warning.
				'style-src-attr': ['unsafe-hashes', 'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo='],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['none'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
