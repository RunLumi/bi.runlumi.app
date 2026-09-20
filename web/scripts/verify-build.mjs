import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const required = ['index.html', 'privacy/index.html', '404.html', 'robots.txt', 'sitemap.xml', 'site.js', '_headers', 'brand/lumi.svg', 'brand/mark.svg'];
for (const file of required) assert.ok((await stat(path.join(root, file))).isFile(), `Missing static output: ${file}`);
const html = await readFile(path.join(root, 'index.html'), 'utf8');
assert.match(html, /<html[^>]+lang="vi"/);
assert.equal((html.match(/<h1\b/g) || []).length, 1, 'One main heading');
assert.match(html, /rel="canonical" href="https:\/\/bi\.runlumi\.app\/"/);
assert.match(html, /Bản xem trước · Dữ liệu giả lập/);
assert.match(html, /mailto:/);
assert.doesNotMatch(html, /astro-island|data-astro-transition|<iframe|<form\b/, 'The public site needs no hydrated app, third-party frame, or fake form');
const executableScript = /<script\b(?![^>]*\bsrc=)(?![^>]*\btype="application\/ld\+json")[^>]*>[\s\S]*?<\/script>/gi;
assert.doesNotMatch(html, executableScript, 'CSP forbids inline executable scripts');
assert.doesNotMatch(html, /<style\b|\sstyle="|\son(?:click|load|error)="/i, 'Keep styles and handlers external for strict CSP');
const localAssets = [...html.matchAll(/(?:src|href)="(\/(?:_astro|brand)\/[^"?#]+|\/site\.js)"/g)].map(match => match[1]);
for (const asset of localAssets) assert.ok((await stat(path.join(root, asset))).isFile(), `Missing asset: ${asset}`);
const headers = await readFile(path.join(root, '_headers'), 'utf8');
assert.match(headers, /script-src 'self'/);
assert.match(headers, /connect-src 'none'/);
assert.doesNotMatch(headers, /unsafe-inline|unsafe-eval/);
const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
assert.match(robots, /Sitemap: https:\/\/bi\.runlumi\.app\/sitemap\.xml/);
assert.match(await readFile(path.join(root, 'sitemap.xml'), 'utf8'), /https:\/\/bi\.runlumi\.app\/privacy\//);
const license = await readFile('node_modules/@fontsource-variable/geist/LICENSE', 'utf8');
assert.match(license, /SIL OPEN FONT LICENSE/i);
await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.txt'), `Lumi BI landing page\nOriginal code: all rights reserved.\n\nGeist font, bundled via @fontsource-variable/geist 5.2.6.\n${license}\n`, 'utf8');
async function filesAt(dir) {
  const items = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(items.map(item => item.isDirectory() ? filesAt(path.join(dir, item.name)) : [path.join(dir, item.name)]))).flat();
}
const files = await filesAt(root);
assert.ok(files.some(file => file.endsWith('.woff2')), 'Geist must be bundled locally');
const scriptBytes = (await stat(path.join(root, 'site.js'))).size;
assert.ok(scriptBytes < 10_000, `Client script exceeds the 10 KB uncompressed budget: ${scriptBytes}`);
console.log(`Static verification passed: ${files.length} files, ${scriptBytes} bytes of client JS, local fonts and notices.`);
