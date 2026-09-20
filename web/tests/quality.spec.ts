import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Loading a CSS font family does not prove that it contains Vietnamese glyphs.
test('Vietnamese alphabet renders entirely with the locally bundled Geist face', async ({ page }) => {
  await page.goto('/');
  const text = 'Ă Â Đ Ê Ô Ơ Ư ă â đ ê ô ơ ư À Á Ả Ã Ạ Ầ Ấ Ẩ Ẫ Ậ Ằ Ắ Ẳ Ẵ Ặ È É Ẻ Ẽ Ẹ Ề Ế Ể Ễ Ệ Ì Í Ỉ Ĩ Ị Ò Ó Ỏ Õ Ọ Ồ Ố Ổ Ỗ Ộ Ờ Ớ Ở Ỡ Ợ Ù Ú Ủ Ũ Ụ Ừ Ứ Ử Ữ Ự Ỳ Ý Ỷ Ỹ Ỵ à á ả ã ạ ầ ấ ẩ ẫ ậ ằ ắ ẳ ẵ ặ è é ẻ ẽ ẹ ề ế ể ễ ệ ì í ỉ ĩ ị ò ó ỏ õ ọ ồ ố ổ ỗ ộ ờ ớ ở ỡ ợ ù ú ủ ũ ụ ừ ứ ử ữ ự ỳ ý ỷ ỹ ỵ';
  await page.evaluate(async text => {
    const probe = document.createElement('p');
    probe.id = 'vietnamese-font-probe';
    probe.textContent = text;
    document.body.append(probe);
    await document.fonts.load('400 16px "Geist Variable"', text);
    await document.fonts.ready;
  }, text);
  await page.locator('#vietnamese-font-probe').scrollIntoViewIfNeeded();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#vietnamese-font-probe' });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every(font => font.isCustomFont && font.familyName.startsWith('Geist'))).toBe(true);
  await cdp.detach();
});

test('mobile sentence breaks and chart labels remain readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const selector of ['.hero-lede br', '.decision-note h4 br', '.faq-section h2 br']) {
    const breaks = page.locator(selector);
    for (let i = 0; i < await breaks.count(); i++) expect(await breaks.nth(i).evaluate(el => getComputedStyle(el).display)).not.toBe('none');
  }
  const size = await page.locator('.chart-labels text').first().evaluate(el => {
    const svg = el.closest('svg')!;
    return parseFloat(getComputedStyle(el).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
  });
  expect(size).toBeGreaterThanOrEqual(12);
});

test('layout stays within the page with 200 percent text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: /Gửi bài toán cho Lumi/ })).toBeVisible();
});

test('built site operates under the exact declared Pages content security policy', async ({ page }) => {
  const policy = readFileSync('public/_headers', 'utf8').split('\n').find(line => line.trim().startsWith('Content-Security-Policy:'))?.split('Content-Security-Policy:')[1]?.trim();
  expect(policy).toBeTruthy();
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://127.0.0.1:4321/**', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy! } });
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('tab', { name: /Tồn kho/ }).click();
  await expect(page.locator('#demo-stock')).toBeVisible();
  await page.locator('.faq-item').first().locator('summary').click();
  expect(errors).toEqual([]);
});
