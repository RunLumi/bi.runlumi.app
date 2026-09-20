import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { site, faqs } from '../src/data/site.ts';
import { renderLlmsTxt } from '../src/lib/geo.ts';

// A narrow assertion over Astro's built output, not a general HTML sanitizer.
// Only our external enhancement script and parsed JSON-LD data blocks are admitted.
export function readJsonLd(html) {
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  assert.equal(blocks.length, (html.match(/<script\b/gi) || []).length, 'Unclosed script tag');
  const graphs = [];
  for (const [, attributes, body] of blocks) {
    if (/^\s+type="application\/ld\+json"\s*$/.test(attributes)) {
      assert(!/[<>&\u2028\u2029]/.test(body), 'JSON-LD must be escaped for its HTML context');
      const graph = JSON.parse(body);
      assert.equal(graph['@context'], 'https://schema.org', 'Expected Schema.org JSON-LD');
      assert(Array.isArray(graph['@graph']), 'Expected an entity graph');
      graphs.push(graph);
    } else {
      assert.match(attributes, /^\s+src="\/scripts\/site\.js"\s+defer(?:="")?\s*$/, 'Unexpected or executable inline script');
      assert.equal(body.trim(), '', 'External scripts cannot contain inline code');
    }
  }
  return graphs;
}

const types = node => [node['@type']].flat();
export async function verifyGeoBuild(root) {
  const read = path => readFile(new URL(`dist/${path}`, root), 'utf8');
  assert.equal(site.origin, 'https://about.bi.runlumi.app', 'Landing must not canonicalize to the BI app');
  const home = `${site.origin}/`;
  const files = (await readdir(new URL('dist/', root), { recursive: true })).filter(path => path.endsWith('.html'));
  for (const path of files) {
    const html = await read(path);
    const graphs = readJsonLd(html);
    const noindex = /<meta\b[^>]*name="robots"[^>]*content="noindex\b/.test(html);
    if (noindex) {
      assert.equal(graphs.length, 0, `No rich metadata for noindex page ${path}`);
      continue;
    }
    assert.equal(graphs.length, 1, `Exactly one entity graph for ${path}`);
    const graph = graphs[0]['@graph'];
    const organization = graph.find(node => types(node).includes('Organization'));
    const website = graph.find(node => types(node).includes('WebSite'));
    const webpage = graph.find(node => types(node).includes('WebPage'));
    assert(organization && website && webpage, `Required entities missing on ${path}`);
    assert.equal(new Set(graph.map(node => node['@id'])).size, graph.length, 'Unique entity IDs');
    assert.equal(organization.name, site.name);
    assert.equal(organization.url, home);
    assert.equal(organization.email, site.email);
    assert.equal(organization.logo, `${site.origin}/brand/lumi.svg`);
    assert.equal(website.name, site.name);
    assert.equal(website.url, home);
    assert.deepEqual(website.publisher, { '@id': organization['@id'] });
    assert.deepEqual(webpage.author, { '@id': organization['@id'] });
    assert.deepEqual(webpage.publisher, { '@id': organization['@id'] });
    assert.deepEqual(webpage.isPartOf, { '@id': website['@id'] });
    assert.equal(webpage.dateModified, site.reviewedAtISO);
    const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
    assert(canonical, `Canonical missing on ${path}`);
    assert.equal(new URL(canonical).origin, site.origin);
    assert.equal(webpage.url, canonical);
    assert(html.includes(`property="og:url" content="${canonical}"`));
    assert(html.includes(`property="og:site_name" content="${site.name}"`));
    assert(html.includes(`name="author" content="${site.name}"`));
    assert(html.includes(`datetime="${site.reviewedAtISO}"`), 'Visible editorial review date');
    assert(html.includes(`href="${site.origin}/llms.txt"`), 'Discoverable llms.txt');
    if (path === 'index.html') {
      assert(types(webpage).includes('FAQPage'));
      assert.deepEqual(webpage.mainEntity, faqs.map(({ question, answer }) => ({
        '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer },
      })), 'FAQ schema must match the shared public answers');
    } else {
      assert(!types(webpage).includes('FAQPage'), 'No homepage FAQ on unrelated pages');
      assert(!('mainEntity' in webpage));
    }
  }
  await stat(new URL('dist/brand/lumi.svg', root));
  const llms = await read('llms.txt');
  assert.equal(llms, renderLlmsTxt(), 'llms.txt must be generated from reviewed content');
  assert(llms.startsWith(`# ${site.name}\n\n> `));
  // Check every Markdown destination against local build output, including anchors.
  for (const [, target] of llms.matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
    const url = new URL(target);
    assert.equal(url.origin, site.origin, 'llms links only to public landing content');
    const file = url.pathname.endsWith('/') ? `${url.pathname.slice(1)}index.html` : url.pathname.slice(1);
    const content = await read(file);
    if (url.hash) assert(content.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Broken llms anchor ${url.hash}`);
  }
  const robots = await read('robots.txt');
  assert.match(robots, /User-agent: \*\s+Allow: \//);
  assert(robots.includes(`Sitemap: ${site.origin}/sitemap.xml`));
  const sitemap = await read('sitemap.xml');
  for (const [, location] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) assert.equal(new URL(location).origin, site.origin);
  assert(!sitemap.includes('/404') && !sitemap.includes('/llms.txt'));
  console.log(`GEO verified: ${files.length} HTML pages; shared entity identity, ${faqs.length} exact FAQ answers, llms.txt and public-domain consistency.`);
