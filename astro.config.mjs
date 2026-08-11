// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

// `site` and `base` are overridden by the GitHub Pages workflow at build time.
export default defineConfig({
  site: 'https://exusiai101.github.io',
  integrations: [icon({ include: { ph: ['*'] } })],
  vite: {
    plugins: [tailwindcss()],
  },
});
