import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkLicensing} from '../scripts/check-licensing.mjs';
import {writeProductNotices} from '../scripts/product-notices.mjs';
const root = new URL('../', import.meta.url);
const files = ['LICENSE', 'NOTICE', 'licensing-policy.json', 'THIRD_PARTY_NOTICES.md',
  'README.md', 'LICENSING.md', 'CONTRIBUTING.md', 'web/README.md',
  'scripts/web-notices.mjs', 'web/scripts/verify-build.mjs',
  ...['', 'apps/web/', 'web/'].flatMap(prefix => [prefix + 'package.json', prefix + 'package-lock.json']),
  ...['packages/cloudflare/', 'packages/core/', 'packages/ui/'].map(prefix => prefix + 'package.json')];
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'lumi-license-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  for (const file of files) {
    await mkdir(dirname(join(dir, file)), {recursive: true});
    await writeFile(join(dir, file), await readFile(new URL(file, root)));
  }
  return dir;
}
async function mutateJson(dir, path, mutate) {
  const value = JSON.parse(await readFile(join(dir, path), 'utf8'));
  mutate(value);
  await writeFile(join(dir, path), JSON.stringify(value));
}
test('license inventory validates the actual repository without network or dependencies', async () => {
  assert.deepEqual(await checkLicensing(), {packages: 6, defaultLicense: 'Elastic-2.0', apacheScopes: 0});
});
const corruptions = [
  ['permissive core metadata', 'package.json', v => {v.license = 'Apache-2.0';}],
  ['stale app lock', 'apps/web/package-lock.json', v => {v.packages[''].license = 'UNLICENSED';}],
  ['accidental registry publication', 'web/package.json', v => {v.private = false;}],
  ['blanket alternate product license', 'licensing-policy.json', v => {v.defaultLicense = 'Elastic-2.0 OR Apache-2.0';}],
  ['unreviewed Apache scope', 'licensing-policy.json', v => {v.apacheScopes = ['packages/core/'];}],
  ['missing package inventory', 'licensing-policy.json', v => {v.packages.pop();}],
  ['duplicate package inventory', 'licensing-policy.json', v => {v.packages.push(v.packages[0]);}],
  ['lock path escape', 'licensing-policy.json', v => {v.packages[0].lock = '../package-lock.json';}],
  ['changed standard license fingerprint', 'licensing-policy.json', v => {v.licenseSha256 = '0'.repeat(64);}],
];
for (const [name, path, mutation] of corruptions) test(`licensing gate rejects ${name}`, async t => {
  const dir = await fixture(t); await mutateJson(dir, path, mutation);
  await assert.rejects(checkLicensing(dir));
});
test('license text cannot be replaced by a summary or extra legal conditions', async t => {
  const dir = await fixture(t); await writeFile(join(dir, 'LICENSE'), 'Elastic License 2.0\nExtra condition: no commercial use.\n');
  await assert.rejects(checkLicensing(dir), /Standard ELv2 text changed/);
});
test('new package and nested license do not acquire unreviewed permissive scope', async t => {
  const dir = await fixture(t); await mkdir(join(dir, 'packages/unreviewed'), {recursive: true});
  await writeFile(join(dir, 'packages/unreviewed/package.json'), '{"license":"Apache-2.0"}');
  await assert.rejects(checkLicensing(dir), /Every source package/);
  await rm(join(dir, 'packages/unreviewed/package.json'));
  await writeFile(join(dir, 'packages/unreviewed/LICENSE'), 'Apache License');
  await assert.rejects(checkLicensing(dir), /Unreviewed nested license/);
});
test('missing attribution and stale marketing claims fail the licensing gate', async t => {
  const dir = await fixture(t); await writeFile(join(dir, 'NOTICE'), '');
  await assert.rejects(checkLicensing(dir), /Product attribution missing/);
  await writeFile(join(dir, 'NOTICE'), await readFile(new URL('NOTICE', root)));
  await writeFile(join(dir, 'web/README.md'), 'Original Lumi code remains reserved.');
  await assert.rejects(checkLicensing(dir), /Stale original-product license claim/);
});
test('built distributions carry exact product terms without replacing third-party notices', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lumi-distribution-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  await writeFile(join(dir, 'THIRD_PARTY_NOTICES.txt'), 'third-party notices remain intact');
  await writeProductNotices(pathToFileURL(dir + '/'));
  for (const name of ['LICENSE', 'NOTICE']) assert.deepEqual(await readFile(join(dir, name + '.txt')), await readFile(new URL(name, root)));
  assert.equal(await readFile(join(dir, 'THIRD_PARTY_NOTICES.txt'), 'utf8'), 'third-party notices remain intact');
});
