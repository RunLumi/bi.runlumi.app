// Maintainer-only: regenerate the committed OG image after intentional copy changes.
// Not part of the Pages build. Uses the locked Playwright browser and local fonts.
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const font = (await readFile(new URL('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', root))).toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="vi"><meta charset="utf-8"><style>@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}*{box-sizing:border-box}body{margin:0;background:#F4F0E8;color:#102A43;font-family:Geist,'Noto Sans',system-ui,sans-serif;width:1200px;height:630px;padding:52px 72px}header{display:flex;align-items:center;gap:16px;border-bottom:1px solid #D9DEE8;padding-bottom:28px}header span{font-size:38px;font-weight:600;letter-spacing:-2px}svg{width:50px;height:60px}h1{font-size:72px;line-height:1.25;letter-spacing:-3.5px;font-weight:650;margin:51px 0 24px}p{font-size:22px;color:#5E6677;margin:0}footer{position:absolute;top:546px;left:72px;right:72px;border-top:1px solid #D9DEE8;padding-top:22px;display:flex;justify-content:space-between;font-size:17px;color:#5E6677}footer span:first-child{color:#006093}</style><header><svg viewBox="0 0 60 68" aria-hidden="true"><path d="M0 19 19 0v49L0 68Zm25 30h35L41 68H6Z" fill="#006093"/></svg><span>Lumi BI</span></header><h1>Thấy rõ kinh doanh.<br>Biết việc cần làm.</h1><p>Commerce Intelligence · Bản xem trước sản phẩm</p><footer><span>bi.runlumi.app</span><span>TIỀN / HÀNG / VẬN HÀNH</span></footer></html>`);
  await page.evaluate(() => document.fonts.ready);
  await mkdir(new URL('public/', root), { recursive: true });
  await page.screenshot({ path: new URL('public/social-card.png', root).pathname });
} finally { await browser.close(); }
