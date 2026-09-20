import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '@runlumi/ui/app.tsx';
// The composition API is the customer's supported entry point. This test proves it is
// importable and returns a component, and that reserved behaviors are core-owned.
test('createApp composes a customer application from pages',()=>{
 const pages=[{path:'/',label:'Home',render:()=>null},{path:'/custom',label:'Custom',render:()=>null}];
 const App=createApp({
  brand:{name:'X',logoSrc:'/x.svg',logoAlt:'',workspaceLabel:'W',footer:null},
  labels:{skipToContent:'s',tenantLabel:'t',tenantAriaLabel:'t',navAriaLabel:'n',noTenantsOption:'o',operatorBar:'b',notFound:'404',demoNotice:'d',demoIdentityAriaLabel:'i'},
  pages,demoIdentities:[]
 });
 assert.equal(typeof App,'function');
});
test('the shared app owns authentication, session and cache isolation (not customer pages)',async()=>{
 const source=await readFile(new URL('../packages/ui/src/app.tsx',import.meta.url),'utf8');
 assert.match(source,/api<Session>\('\/api\/session'/,'session comes from the core client');
 assert.match(source,/new QueryClient/,'cache isolation is core-owned');
 assert.match(source,/IdentityScope/,'identity scoping is core-owned');
});
test('the reference app is thin composition, not a second core',async()=>{
 const source=await readFile(new URL('../apps/web/src/App.tsx',import.meta.url),'utf8');
 assert.match(source,/createApp\(config\)/,'reference app composes via the public API');
 assert(!/createApi|new QueryClient|verifyAccessToken/.test(source),'the browser app must not reimplement server/core behavior');
});
