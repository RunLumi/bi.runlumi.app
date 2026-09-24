import test from 'node:test';
import assert from 'node:assert/strict';
import {withDashboardPage} from '../packages/ui/src/app-pages.ts';

test('customer dashboard renderer replaces only the registered core root page',()=>{
 const builtin=()=> 'core dashboard';
 const customer=()=> 'customer dashboard';
 const operations=()=> 'operations';
 const pages=[{path:'/',label:'Overview',render:builtin},{path:'/operations',label:'Operations',render:operations}];
 const result=withDashboardPage(pages,customer);
 assert.equal(result[0].render,customer);
 assert.equal(result[0].label,'Overview');
 assert.equal(result[1],pages[1]);
 assert.equal(pages[0].render,builtin,'composition does not mutate shared config');
});

test('customer dashboard slot fails closed if core did not register exactly one root',()=>{
 assert.throws(()=>withDashboardPage([{path:'/operations',render:()=>null}],()=>null),/DASHBOARD_ROUTE_REQUIRED/);
 assert.throws(()=>withDashboardPage([{path:'/',render:()=>null},{path:'/',render:()=>null}],()=>null),/DASHBOARD_ROUTE_REQUIRED/);
});
