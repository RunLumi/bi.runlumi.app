// Offline consistency checks, not legal clearance or proof of contributor rights.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
// Exact, unmodified ELv2 text; source blob 809108b857ffd2c2a93cafc5b69e496f3b6ace04.
const LICENSE_SHA256 = '48255018b41fc0e965b1115af7e6779bc218bb8a6747d561da800d5022622aa2';
const SKIP = new Set(['node_modules', 'dist', 'coverage', 'artifacts', 'test-results', 'playwright-report', 'validation-artifacts']);
async function sourceFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Review source symlink before license classification: ${path}`);
    if (entry.isDirectory()) files.push(...await sourceFiles(path, base));
    else files.push(relative(base, path).replaceAll('\\', '/'));
  }
  return files;
}
export async function checkLicensing(root = ROOT) {
  const read = path => readFile(resolve(root, path), 'utf8');
  const policy = JSON.parse(await read('licensing-policy.json'));
  assert.equal(policy.schemaVersion, 1, 'Unknown licensing policy schema');
  assert.equal(policy.defaultLicense, 'Elastic-2.0', 'Product license changes need explicit owner review');
  assert.equal(policy.licenseFile, 'LICENSE');
  const license = await read('LICENSE');
  assert.equal(policy.licenseSha256, LICENSE_SHA256, 'Unreviewed canonical license fingerprint');
  assert.equal(createHash('sha256').update(license).digest('hex'), LICENSE_SHA256, 'Standard ELv2 text changed');
  assert.equal(policy.copyrightNotice, 'Copyright (c) 2026 RunLumi. All rights reserved except as expressly licensed.');
  assert((await read('NOTICE')).includes(policy.copyrightNotice), 'Product attribution missing');
  assert.equal(policy.thirdPartyNotice, 'THIRD_PARTY_NOTICES.md');
  assert((await read(policy.thirdPartyNotice)).length > 100, 'Third-party notice inventory missing');

  // No separate original SDK/starter exists at adoption. A future opt-in requires
  // updating this gate, provenance review, notices and the public scope map together.
  assert.deepEqual(policy.apacheScopes, [], 'Apache scopes need explicit extraction and owner/provenance review');
  assert(Array.isArray(policy.packages) && policy.packages.length > 0, 'Package license inventory missing');
  const files = await sourceFiles(root);
  const manifests = files.filter(path => /(^|\/)package\.json$/.test(path)).sort();
  const declared = policy.packages.map(entry => entry.manifest);
  assert.equal(new Set(declared).size, declared.length, 'Duplicate package license entry');
  assert.deepEqual([...declared].sort(), manifests, 'Every source package needs a reviewed license entry');
  for (const entry of policy.packages) {
    assert.match(entry.manifest, /^(?:[a-zA-Z0-9_-]+\/)*package\.json$/, 'Unsafe manifest path');
    assert.match(entry.lock, /^(?:[a-zA-Z0-9_-]+\/)*package-lock\.json$/, 'Unsafe lock path');
    assert.equal(entry.license, 'Elastic-2.0', 'No product package is Apache-licensed by default');
    assert.equal(entry.private, true, 'Registry publication requires its own approval');
    const pkg = JSON.parse(await read(entry.manifest));
    const lock = JSON.parse(await read(entry.lock));
    assert.equal(pkg.license, entry.license, `License mismatch: ${entry.manifest}`);
    assert.equal(pkg.private, true, `Accidental registry publication: ${entry.manifest}`);
    const workspacePath = entry.lock === 'package-lock.json'
      ? (entry.manifest === 'package.json' ? '' : entry.manifest.replace(/\/package\.json$/, ''))
      : '';
    const locked = lock.packages?.[workspacePath];
    assert.equal(locked?.license, pkg.license, `Lock package license mismatch: ${entry.manifest}`);
    assert.equal(locked?.name, pkg.name, `Lock package name mismatch: ${entry.manifest}`);
    assert.equal(locked?.version, pkg.version, `Lock package version mismatch: ${entry.manifest}`);
  }
  for (const file of files) {
    assert(file === 'LICENSE' || !/(^|\/)(?:LICENSE|COPYING)(?:\.[^/]*)?$/i.test(file),
      `Unreviewed nested license scope: ${file}`);
  }
  for (const file of ['README.md', 'LICENSING.md', 'CONTRIBUTING.md', 'web/README.md',
    'scripts/web-notices.mjs', 'web/scripts/verify-build.mjs']) {
    assert(!/private\/reserved|remains reserved|Original Lumi code: UNLICENSED/.test(await read(file)),
      `Stale original-product license claim: ${file}`);
  }
  return {packages: declared.length, defaultLicense: policy.defaultLicense, apacheScopes: 0};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkLicensing();
  console.log(`Licensing checks passed: ${result.packages} ELv2 packages, exact license text, retained attribution, no undeclared Apache scopes.`);
}
