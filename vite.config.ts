import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	optimizeDeps: { exclude: ['maplibre-gl'] },
	define: { __BASE__: JSON.stringify(process.env.BASE_PATH ?? '') },
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: '404.html' }),
			// Per GitHub Pages: BASE_PATH=/anm-open npm run build
			alias: { $lib: 'src/lib', '$lib/*': 'src/lib/*' },
			paths: { base: (process.env.BASE_PATH ?? '') as '' }
		})
	]
});
