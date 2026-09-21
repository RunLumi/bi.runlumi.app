import { defineConfig } from 'astro/config';
import { site } from './src/data/site.ts';

// Marketing is a static, separately deployed surface; never bind it to installation data.
export default defineConfig({
  site: site.origin,
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
});
