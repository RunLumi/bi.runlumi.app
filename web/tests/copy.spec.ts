import { test, expect } from '@playwright/test';

const jargon = /\b(pilot|production|foundation|SKU|dashboard)\b/i;

test('plain Vietnamese covers every interactive panel and expanded disclosure', async ({ page }) => {
  await page.goto('/');
  // textContent includes inactive panels and closed details, unlike innerText.
  expect(await page.locator('main').textContent()).not.toMatch(jargon);
  for (const id of ['money', 'stock', 'operations']) {
    await page.locator(`[data-demo-tab="${id}"]`).click();
    const panel = page.locator(`#demo-${id}`);
    await expect(panel).toBeVisible();
    await panel.locator('.evidence-disclosure summary').click();
    await panel.locator('.chart-data summary').click();
    await expect(panel.locator('.evidence-disclosure dd').first()).toBeVisible();
    await expect(panel.locator('table')).toBeVisible();
    expect(await panel.innerText()).not.toMatch(jargon);
  }
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /Rõ tiền\. Rõ hàng\. Vững quyết định\./);
});

test('no-JavaScript copy includes all scenarios without hidden jargon', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4321/');
    for (const id of ['money', 'stock', 'operations']) await expect(page.locator(`#demo-${id}`)).toBeVisible();
    expect(await page.locator('main').textContent()).not.toMatch(jargon);
    await expect(page.locator('.contact-action > a')).toHaveText('Trao đổi với Lumi');
  } finally { await context.close(); }
});
