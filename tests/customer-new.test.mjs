import test from 'node:test';
import assert from 'node:assert/strict';
import {substituteCustomerTemplate} from '../scripts/customer-new.mjs';

test('customer generator keeps Vite build defines for the build while resolving customer tokens',()=>{
 const source='brand: __CUSTOMER_ID__, version: __LUMI_BUILD_VERSION__, time: __LUMI_BUILD_TIME__, git: __LUMI_GIT_HASH__';
 const result=substituteCustomerTemplate(source,{__CUSTOMER_ID__:'baga'});
 assert.equal(result,'brand: baga, version: __LUMI_BUILD_VERSION__, time: __LUMI_BUILD_TIME__, git: __LUMI_GIT_HASH__');
});

test('customer generator still rejects an unknown unresolved template token',()=>{
 assert.throws(()=>substituteCustomerTemplate('value: __MISSING_TOKEN__',{}),/Missing substitution __MISSING_TOKEN__/);
});
