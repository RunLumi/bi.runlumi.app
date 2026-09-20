import { test, expect } from '@playwright/test';

test('landing has truthful content, working local assets and no page overflow', async ({ page }, info) => {
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Lumi BI/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Thấy rõ tiền.');
  await expect(page.getByText('Bản xem trước · Dữ liệu giả lập', { exact: true })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://bi.runlumi.app/');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('500 16px "Geist Variable"'))).toBe(true);
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(244, 240, 232)');
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await page.screenshot({ path: info.outputPath('landing-full.png'), fullPage: true });
  await page.locator('.preview-frame').screenshot({ path: info.outputPath('product-preview.png') });
});

test('all three preview tabs work with keyboard and preserve explicit uncertainty', async ({ page }) => {
  await page.goto('/');
  const money = page.getByRole('tab', { name: /Tiền & hiệu quả/ });
  const stock = page.getByRole('tab', { name: /Tồn kho/ });
  await expect(money).toHaveAttribute('aria-selected', 'true');
  await stock.click();
  await expect(stock).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#demo-stock')).toBeVisible();
  await expect(page.locator('#demo-money')).toBeHidden();
  await expect(page.locator('#demo-stock')).toContainText('Chưa rõ');
  await stock.focus();
  await page.keyboard.press('End');
  await expect(page.locator('#demo-operations')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Vận hành/ })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(money).toBeFocused();
  await expect(page.locator('#demo-money')).toBeVisible();
  await page.locator('#demo-money').getByText('Con số này đến từ đâu?', { exact: true }).click();
  await expect(page.locator('#demo-money .evidence-content')).toBeVisible();
  await expect(page.locator('#demo-money .total-row')).toContainText('228');
});

test('mobile disclosure closes with Escape and restores focus', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only navigation');
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menu' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('contact explicitly opens email; no fake submission or customer data calls', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (['fetch', 'xhr'].includes(request.resourceType())) requests.push(request.url()); });
  await page.goto('/');
  const link = page.getByRole('link', { name: /Gửi bài toán cho Lumi/ });
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^mailto:hello@runlumi\.app\?subject=/);
  expect(decodeURIComponent(href || '')).toContain('Một câu hỏi kinh doanh cần trả lời');
  await expect(page.locator('#pilot')).toContainText('Website không tự gửi hoặc lưu đăng ký.');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('native FAQ and privacy route work', async ({ page }) => {
  await page.goto('/');
  const item = page.locator('.faq-item').first();
  await item.locator('summary').click();
  await expect(item).toHaveAttribute('open', '');
  await expect(item.locator('p')).toContainText('foundation preview');
  await page.getByRole('link', { name: 'Quyền riêng tư', exact: true }).click();
  await expect(page).toHaveTitle('Quyền riêng tư trên website · Lumi BI');
  await expect(page.locator('h1')).toContainText('Quyền riêng tư');
});

test('content, evidence and email remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.locator('#demo-money')).toBeVisible();
  await expect(page.locator('#demo-stock')).toBeVisible();
  await expect(page.locator('#demo-operations')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Gửi bài toán cho Lumi/ })).toHaveAttribute('href', /^mailto:/);
  await context.close();
});

test('small screens, large text and reduced motion remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior)).toBe('auto');
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('every internal fragment points to a real target', async ({ page }) => {
  await page.goto('/');
  const invalid = await page.locator('a[href*="#"]').evaluateAll(links => links.flatMap(link => {
    const url = new URL((link as HTMLAnchorElement).href);
    if (url.pathname !== '/' || !url.hash) return [];
    return document.getElementById(decodeURIComponent(url.hash.slice(1))) ? [] : [url.hash];
  }));
  expect(invalid).toEqual([]);
});
