import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://namesake.dustincoledata.com',
  base: '/',
  output: 'static',
  trailingSlash: 'ignore',
});
