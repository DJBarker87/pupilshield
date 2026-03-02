import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			'@djb/shield': path.resolve(__dirname, '../../packages/shield/src/index.js'),
			'@djb/prompts': path.resolve(__dirname, '../../prompts/engine.browser.js')
		}
	}
});
