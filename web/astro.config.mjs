import { defineConfig } from 'astro/config';

// Marketing is a static, separately deployed surface; never bind it to tenant data.
export default defineConfig({
  site: 'https://bi.runlumi.app',
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
});
