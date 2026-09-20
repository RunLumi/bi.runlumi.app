import { defineConfig } from 'astro/config';

// The marketing site is a static Pages project, not the authenticated BI app.
// No Cloudflare SSR adapter, API binding, tenant data, or runtime secret is needed.
export default defineConfig({
  site: 'https://bi.runlumi.app',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
});
