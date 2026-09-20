import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const exists = async path => { await stat(new URL(path, root)); };
for (const file of ['dist/index.html', 'dist/404.html', 'dist/quyen-rieng-tu/index.html', 'dist/robots.txt', 'dist/sitemap.xml', 'dist/_headers', 'dist/favicon.svg', 'dist/scripts/site.js']) await exists(file);
const html = await read('dist/index.html');
assert.match(html, /<html[^>]+lang="vi"/);
assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'Exactly one page heading');
assert.match(html, /rel="canonical"[^>]*href="https:\/\/bi\.runlumi\.app\/"/);
assert.match(html, /Dữ liệu giả lập/);
assert.match(html, /Chưa đủ dữ liệu/);
assert.match(html, /Tích hợp dự kiến/);
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'CSP forbids inline scripts');
assert(!/<style[\s>]|\sstyle=/i.test(html), 'CSP forbids inline CSS');
assert(!/https?:\/\/(?:www\.)?(?:googletagmanager|google-analytics|connect\.facebook)/.test(html), 'No trackers');
assert(!html.includes('astro-island'), 'No hydrated framework runtime on the marketing page');
const js = await read('dist/scripts/site.js');
assert(Buffer.byteLength(js) <= 10_000, 'Progressive-enhancement JS exceeds 10 kB raw budget');
assert(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage)\s*[(.]/.test(js), 'No network or storage in demo interactions');
const png = await readFile(new URL('dist/social-card.png', root));
assert.equal(png.readUInt32BE(16), 1200, 'OG width');
assert.equal(png.readUInt32BE(20), 630, 'OG height');
assert.match(await read('dist/sitemap.xml'), /https:\/\/bi\.runlumi\.app\/quyen-rieng-tu\//);
assert(!/404/.test(await read('dist/sitemap.xml')));
const headers = await read('dist/_headers');
assert.match(headers, /script-src 'self'/);
assert(!headers.includes('unsafe-inline'));
assert(!headers.includes('unsafe-eval'));
const entries = await readdir(new URL('dist/', root));
assert(!entries.includes('_worker.js'), 'Public site must remain static');
assert(!entries.includes('functions'), 'Public site must not bind tenant services');

// Only local font binaries and an adapted utility-glyph subset are redistributed.
// Build tools are not a browser runtime; the exact graph and integrity are in the lock.
let notices = 'Lumi BI landing page — distribution notices\nOriginal Lumi code: UNLICENSED. See repository LICENSE.\n\n';
for (const pkg of ['geist', 'geist-mono']) notices += `\n@fontsource-variable/${pkg}\n` + await read(`node_modules/@fontsource-variable/${pkg}/LICENSE`) + '\n';
notices += '\nUtility arrow/check/chevron/menu paths adapted from Tabler Icons, Copyright (c) 2020 Paweł Kuna, MIT. Product glyphs are original Lumi geometry.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n';
await writeFile(new URL('dist/THIRD_PARTY_NOTICES.txt', root), notices);
let assetBytes = 0;
for (const file of await readdir(new URL('dist/_astro/', root))) assetBytes += (await stat(new URL(join('dist/_astro', file), root))).size;
console.log(`Static build verified: ${Buffer.byteLength(html)} B HTML; ${Buffer.byteLength(js)} B interaction JS; ${assetBytes} B hashed assets.`);
