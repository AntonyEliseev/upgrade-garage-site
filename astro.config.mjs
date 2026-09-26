// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// Домен и базовый путь приходят из сборки (GitHub Actions берёт их из настроек Pages, см. docs/deploy.md).
// Локально: сайт в корне, домен-заглушка.
const SITE_URL = process.env.SITE_URL || 'https://kosmos-upgrade.example';
const BASE_PATH = process.env.BASE_PATH || '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  build: { format: 'file', inlineStylesheets: 'auto' },
  integrations: [
    preact(),
    sitemap({ filter: (page) => !page.includes('/404') }),
  ],
  image: { responsiveStyles: false },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
