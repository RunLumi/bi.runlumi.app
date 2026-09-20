// Maintainer-only: regenerate the committed social image after copy changes.
// Run with web/.nvmrc and the locked Playwright browser. No network requests.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { site } from '../src/data/site.ts';

const root = new URL('../', import.meta.url);
const fontRoot = new URL('node_modules/@fontsource-variable/geist/', root);
let fonts = await readFile(new URL('index.css', fontRoot), 'utf8');
for (const [, path] of [...fonts.matchAll(/url\((\.\/files\/[^)]+\.woff2)\)/g)]) {
  const bytes = await readFile(new URL(path, fontRoot));
  fonts = fonts.replaceAll(`url(${path})`, `url(data:font/woff2;base64,${bytes.toString('base64')})`);
}
const brand = (await readFile(new URL('public/brand/lumi.svg', root))).toString('base64');
const escape = text => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const headline = site.title.replace(/^Lumi BI \| /, '');
assert(headline.includes(' Vững quyết định.'), 'Review the social layout when changing the headline');
const lines = headline.split(' Vững quyết định.');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="vi"><meta charset="utf-8"><style>${fonts}
*{box-sizing:border-box}body{margin:0;background:#F4F0E8;color:#102A43;font-family:'Geist Variable','Noto Sans',system-ui,sans-serif;width:1200px;height:630px;padding:52px 72px}
header{display:flex;align-items:center;gap:16px;border-bottom:1px solid #D9DEE8;padding-bottom:28px}header img{width:119px;height:49px}header span{font-size:34px;font-weight:500;border-left:1px solid #C8D0DE;padding-left:16px}
h1{font-size:76px;line-height:1.25;letter-spacing:-3.5px;font-weight:650;margin:53px 0 24px}p{font-size:22px;color:#5E6677;margin:0}
footer{position:absolute;top:546px;left:72px;right:72px;border-top:1px solid #D9DEE8;padding-top:22px;display:flex;justify-content:space-between;font-size:17px;color:#5E6677}footer span:first-child{color:#006093}
</style><header><img src="data:image/svg+xml;base64,${brand}" alt="Lumi"><span>BI</span></header><h1>${escape(lines[0])}<br>Vững quyết định.</h1><p>Phân tích kinh doanh · Sản phẩm đang phát triển</p><footer><span>${escape(new URL(site.origin).hostname)}</span><span>TIỀN / TỒN KHO / VIỆC CẦN LÀM</span></footer></html>`);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('h1').innerText(), headline.replace(' Vững quyết định.', '\nVững quyết định.'));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), 'Social card must not clip');
  await mkdir(new URL('public/', root), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('public/social-card.png', root)) });
} finally { await browser.close(); }
