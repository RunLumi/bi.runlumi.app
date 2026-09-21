import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFile, readFile, rm, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));

test('stale dist output is cleared by the package build and cannot reach the archive',async()=>{
 // Seed an obsolete module that no longer has a source file, exactly as a
 // deleted tenant router would be left behind by an incomplete cleanup.
 const stale=path.join(root,'packages','core','dist','__stale-tenant-router.js');
 try{
  await mkdir(path.dirname(stale),{recursive:true});
  await writeFile(stale,'export const STALE_TENANT_ROUTER=1;\n');
  const build=spawnSync(process.execPath,[path.join(root,'scripts','build-package.mjs'),'core'],{encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  await assert.rejects(()=>readFile(stale),'obsolete dist output must be removed by the build');
 }finally{await rm(stale,{force:true});}
});

test('core-pack refuses to ship a package containing a retired construct',async()=>{
 // Scan function parity: reproduce the pack-time scan against a synthetic
 // package body so this test does not depend on real release contents.
 const RETIRED_CONSTRUCTS=[
  [/tenant_id|tenantId\b/,'tenant identifier'],
  [/'\/api\/tenants/,'tenant API route'],
  [/CONTROL_DB|CONTROL_API|CELL_ID\b/,'control/cell bindings'],
  [/tenants\/[^'"`]*\/commerce\//,'tenant-scoped storage path'],
  [/cloudflareaccess\.com\/.*tenants/,'tenant access issuer']
 ];
 const scan=body=>RETIRED_CONSTRUCTS.find(([pattern])=>pattern.test(body));
 assert.ok(scan('const tenantId="x";'),'tenant identifiers must be flagged');
 assert.ok(scan("fetch('/api/tenants/x')"),'tenant routes must be flagged');
 assert.ok(scan('env.CONTROL_DB.prepare()'),'control bindings must be flagged');
 assert.ok(scan('`tenants/alpha/commerce/raw/x`'),'tenant storage paths must be flagged');
 // Legitimate business vocabulary and current code must pass.
 assert.equal(scan('const shops=["channel-1"]; // one company, many shops'),undefined);
 assert.equal(scan((await readFile(new URL('../packages/core/src/api.ts',import.meta.url),'utf8'))),undefined,'current core source must pass the scan');
});
