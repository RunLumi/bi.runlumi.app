import { test, expect } from '@playwright/test';
import { site, faqs } from '../src/data/site';
import { publicContactEmail } from '../src/data/contact';
import { createStructuredData, serializeJsonLd, renderLlmsTxt } from '../src/lib/geo';

const metadata = { canonical: `${site.origin}/`, title: site.title, description: site.description, includeFaq: true };

test('JSON-LD serialization prevents script breakout and rejects incorrect canonicals', () => {
  const hostile = { text: '</script><script>globalThis.injected=true</script>&\u2028\u2029' };
  const serialized = serializeJsonLd(hostile);
  expect(serialized).not.toMatch(/[<>&\u2028\u2029]/);
  expect(JSON.parse(serialized)).toEqual(hostile);
  expect(() => serializeJsonLd(undefined)).toThrow();
  for (const canonical of [`${site.appOrigin}/`, `${site.origin}/?preview=1`, `${site.origin}/#fragment`]) {
    expect(() => createStructuredData({ ...metadata, canonical })).toThrow();
  }
  expect(() => createStructuredData({ ...metadata, canonical: `${site.origin}/quyen-rieng-tu/` })).toThrow();
});

test('raw HTML exposes consistent organization, website, author and FAQ entities', async ({ request }) => {
  expect(site.origin).toBe('https://about.bi.runlumi.app');
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  expect(blocks).toHaveLength(1);
  const graph = JSON.parse(blocks[0][1]!);
  const organization = graph['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'Organization');
  const email = publicContactEmail(organization.email);
  expect(html).toContain(`href="mailto:${email}"`);
  expect(graph).toEqual(createStructuredData({ ...metadata, email }));
  expect(html).toContain(`name="author" content="${site.name}"`);
  expect(html).toContain(`href="${site.origin}/llms.txt"`);
  expect((await request.get('/brand/lumi.svg')).status()).toBe(200);
  expect(response.headers()['content-security-policy']).not.toMatch(/unsafe-inline|unsafe-eval/);
});

test('FAQ schema exactly matches the human-readable questions and answers', async ({ page }) => {
  await page.goto('/');
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  const entity = data['@graph'].find((node: Record<string, unknown>) => [node['@type']].flat().includes('FAQPage'));
  const details = page.locator('.faq-list details');
  await expect(details).toHaveCount(faqs.length);
  expect(entity.mainEntity).toHaveLength(faqs.length);
  for (let i = 0; i < faqs.length; i++) {
    const item = details.nth(i);
    await item.locator('summary').click();
    await expect(item.locator('summary span').first()).toHaveText(entity.mainEntity[i].name);
    await expect(item.locator('p')).toBeVisible();
    await expect(item.locator('p')).toHaveText(entity.mainEntity[i].acceptedAnswer.text);
  }
  await expect(page.locator('footer [rel="author"]')).toHaveText(site.name);
  await expect(page.locator('footer time')).toHaveAttribute('datetime', site.reviewedAtISO);
});

test('metadata and llms content remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4321/');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await page.getByRole('link', { name: 'Thông tin cho AI' }).click();
    await expect(page.locator('body')).toContainText(site.description);
    await expect(page.locator('body')).toContainText(faqs[1]!.answer);
  } finally {
    await context.close();
  }
});

test('privacy has its own WebPage and missing routes never advertise homepage FAQs', async ({ page, request }) => {
  await page.goto('/quyen-rieng-tu/');
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  const webpage = data['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'WebPage');
  expect(webpage.url).toBe(`${site.origin}/quyen-rieng-tu/`);
  expect(webpage.mainEntity).toBeUndefined();
  expect(JSON.stringify(data)).not.toContain('FAQPage');
  const response = await request.get('/not-a-real-geo-page/');
  expect(response.status()).toBe(404);
  const missing = await response.text();
  expect(missing).toContain('noindex, follow');
  expect(missing).not.toContain('application/ld+json');
});

test('llms.txt, crawler access and sitemap use the landing domain', async ({ request }) => {
  const response = await request.get('/llms.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);
  const llms = await response.text();
  const homepage = await (await request.get('/')).text();
  const email = homepage.match(/href="mailto:([^"?]+)"/)?.[1];
  expect(email).toBeTruthy();
  expect(llms).toBe(renderLlmsTxt(email));
  for (const { question, answer } of faqs) {
    expect(llms).toContain(question);
    expect(llms).toContain(answer);
  }
  for (const [, target] of llms.matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
    const url = new URL(target!);
    expect(url.origin).toBe(site.origin);
    expect((await request.get(url.pathname)).status()).toBe(200);
  }
  expect(await (await request.get('/robots.txt')).text()).toContain(`Sitemap: ${site.origin}/sitemap.xml`);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(`${site.origin}/quyen-rieng-tu/`);
  expect(sitemap).not.toContain(`${site.appOrigin}/`);
});

test('JSON-LD remains inert and executable inline JavaScript remains blocked', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: /Tiền và lợi nhuận/ })).toHaveAttribute('aria-selected', 'true');
  const executed = await page.evaluate(() => {
    const target = window as unknown as Record<string, unknown>;
    target.inlineGeoProbe = false;
    const script = document.createElement('script');
    script.textContent = 'window.inlineGeoProbe = true';
    document.head.append(script);
    script.remove();
    return target.inlineGeoProbe;
  });
  expect(executed).toBe(false);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});
