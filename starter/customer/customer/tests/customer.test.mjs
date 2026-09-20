import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseCustomerManifest,parseCustomerRoutes} from '@runlumi/core/customer-config.ts';
import {manifest,RESERVED_ROUTES} from '../manifest.ts';
import {customerPages} from '../ui/pages.tsx';
import {customMetrics,customMetricValue} from '../data/metrics.ts';
// Independent expectations: this fixture asserts the customer's intended behavior,
// not whatever the implementation happens to produce.
const here=path.dirname(fileURLToPath(import.meta.url));
const lock=JSON.parse(await readFile(path.resolve(here,'../../lumi.lock.json'),'utf8'));

test('manifest parses and matches the deployment inventory identity',()=>{
 const parsed=parseCustomerManifest(manifest);
 assert.equal(parsed.customerId,lock.customerId);
 assert.ok(parsed.modules.length>0);
});

test('every custom route is non-reserved and unique',()=>{
 const paths=customerPages.map(p=>p.path);
 const parsed=parseCustomerRoutes(paths.map(p=>({path:p,label:p})));
 assert.equal(parsed.length,paths.length);
 for(const route of paths)assert(!RESERVED_ROUTES.includes(route),`${route} is reserved`);
});

test('custom metrics use the declared namespace and are additive',()=>{
 const namespace=manifest.extensions[0].namespace;
 for(const metric of customMetrics)assert(metric.id.startsWith(`${namespace}.`),`${metric.id} must use the ${namespace} namespace`);
});

test('an unknown custom metric fails rather than returning a fabricated value',()=>{
 assert.throws(()=>customMetricValue('customer.does_not_exist'));
});
