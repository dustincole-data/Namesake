import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://dustincoledata.com',
  base: '/projects/namesake',
  // Nest physical output under the base so a static host serves files at the same
  // paths the HTML links to (dist/projects/namesake/name/dustin == /projects/namesake/name/dustin).
  // Vercel "Output Directory" = dist; the main-site rewrite proxies /projects/namesake/* 1:1.
  outDir: './dist/projects/namesake',
  output: 'static',
  trailingSlash: 'ignore',
});
