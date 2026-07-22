import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://dustincoledata.com',
  base: '/projects/namesake',
  output: 'static',
  trailingSlash: 'ignore',
});
