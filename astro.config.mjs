import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://namesake.dustincoledata.com',
  base: '/',
  output: 'static',
  trailingSlash: 'ignore',
  // Bare /name has no page (routes are /name/[slug] and /name/lookup) — send it home.
  redirects: { '/name': '/' },
});
