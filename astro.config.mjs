import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://elwizard33.github.io',
  base: '/oas-mcp/',
  srcDir: './astro-src',
  outDir: './build',
  integrations: [],
  build: { format: 'directory' }
});
