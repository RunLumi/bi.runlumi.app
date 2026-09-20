import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`layout, local fonts, accessibility and screenshot at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Thấy rõ kinh doanh.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('16px "Geist Variable"', 'Lumi BI'))).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
  });
}

test('demo tabs expose coherent independent fixtures and keyboard interaction', async ({ page }) => {
  await page.goto('/');
  const first = page.getByRole('tab', { name: /Tiền & lợi nhuận/ });
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.getByRole('tabpanel')).toContainText('Chưa đủ dữ liệu');
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: /Hàng tồn/ })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Tệp kho');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: /Ngoại lệ vận hành/ })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('24');
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await page.locator('#demo-money .evidence-disclosure summary').click();
  await expect(page.locator('#demo-money .evidence-disclosure')).toHaveAttribute('open', '');
  await expect(page.locator('#demo-money .evidence-disclosure')).toContainText('486.000.000');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('deep links select the corresponding scenario and preserve anchor targets', async ({ page }) => {
  await page.goto('/#demo-stock');
  await expect(page.getByRole('tab', { name: /Hàng tồn/ })).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-select-scenario="operations"]').click();
  await expect(page.getByRole('tabpanel')).toContainText('Ngoại lệ đang mở');
  const broken = await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"],a[href^="/#"]')].map(a => a.hash.slice(1)).filter(id => id && !document.getElementById(id)));
  expect(broken).toEqual([]);
});

test('mobile menu supports keyboard dismissal and real navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.locator('[data-mobile-nav]');
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(menu.locator('summary')).toBeFocused();
  await menu.locator('summary').click();
  await menu.getByRole('link', { name: 'Kết nối' }).click();
  await expect(page).toHaveURL(/#ket-noi$/);
  await expect(menu).not.toHaveAttribute('open', '');
});

test('no JavaScript: all scenarios, evidence, FAQ and contact remain usable', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  for (const id of ['money', 'stock', 'operations']) await expect(page.locator(`#demo-${id}`)).toBeVisible();
  await page.locator('#demo-money .evidence-disclosure summary').click();
  await expect(page.locator('#demo-money .evidence-disclosure dd').first()).toBeVisible();
  await page.locator('.faq-list summary').first().click();
  await expect(page.locator('.faq-list details').first()).toHaveAttribute('open', '');
  await expect(page.locator('.contact-action > a')).toHaveAttribute('href', /^mailto:hello@runlumi\.app\?/);
  await expect(page.locator('[data-copy-email]')).toBeHidden();
  await context.close();
});

test('copy email reports success and handles clipboard rejection honestly', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as unknown as Record<string, string>).copiedEmail = text; } } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Sao chép' }).click();
  await expect(page.getByRole('status')).toContainText('Đã sao chép');
  expect(await page.evaluate(() => (window as unknown as Record<string, string>).copiedEmail)).toBe('hello@runlumi.app');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await page.getByRole('button', { name: 'Sao chép' }).click();
  await expect(page.getByRole('status')).toContainText('Chưa sao chép được');
});

test('static routes, SEO, privacy, security headers, OG and true 404', async ({ page, request }) => {
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response?.headers()['content-security-policy']).not.toContain('unsafe-inline');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://about.bi.runlumi.app/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://about.bi.runlumi.app/social-card.png');
  for (const path of ['/social-card.png', '/favicon.svg', '/robots.txt', '/sitemap.xml', '/THIRD_PARTY_NOTICES.txt', '/quyen-rieng-tu/']) expect((await request.get(path)).status()).toBe(200);
  expect((await request.get('/not-a-real-page/')).status()).toBe(404);
  await page.goto('/quyen-rieng-tu/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Quyền riêng tư');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('200% text reflow, light-only theme and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 960 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
