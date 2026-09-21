import {readFile,readdir} from 'node:fs/promises';
import {LocalDatabase,LocalObjects,request} from '../scripts/local-adapters.mjs';
import {createApi} from '../packages/core/src/api.ts';

export {request};

// API field names and synthetic-only fixture credentials. Values are test
// fixtures for a local SQLite database, never real secrets; the field name is
// kept as a constant so call sites read uniformly.
export const SECRET_FIELD='password';
export const fixturePasswords={owner:'owner-password-1',staff:'staff-password-1',fresh:'fresh-password-9',reset:'owner-reset-password-3',changed:'renamed-password-2',attacker:'attacker-pass-1',second:'owner-password-2'};
/** Body for direct sign-in endpoints. */
export const creds=(login,value)=>({login,[SECRET_FIELD]:value});

const MIGRATION_DIR=new URL('../migrations/installation/',import.meta.url);

/** Empty installation with ALL installation migrations applied and no users. */
export async function emptyInstallation(){
  const db=new LocalDatabase();
  const files=(await readdir(MIGRATION_DIR)).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files)db.db.exec(await readFile(new URL(`../migrations/installation/${file}`,import.meta.url),'utf8'));
  return db;
}

/** A running API bound to one installation. `setup` performs the real
 * first-run journey and returns the owner's session cookie. */
export async function fixture({seed=true}={}){
  const db=await emptyInstallation();
  const objects=new LocalObjects();
  const env={DB:db,SOURCES:objects,ASSETS:{async fetch(){return new Response('asset');}},DEPLOYMENT_ID:'local',ENVIRONMENT:'test',SETUP_TOKEN:seed?undefined:'setup-token-xyz'};
  const api=createApi(async()=>({issuer:'local',subject:'no-one'}),false,{standalone:true});
  let ownerCookie='';
  if(seed){
    const response=await api(request('/api/setup',{method:'POST',body:{name:'Acme BI',login:'admin@acme.test',displayName:'Acme Admin',[SECRET_FIELD]:fixturePasswords.owner}}),env);
    if(response.status!==201)throw new Error(`setup failed: ${await response.text()}`);
    ownerCookie=cookieOf(response);
  }
  let closed=false;
  const close=()=>{if(closed)return;closed=true;db.close();};
  return {db,objects,env,api,ownerCookie,close};
}

export function cookieOf(response){const header=response.headers.get('set-cookie')??'';return header.split(';')[0]??'';}

/** Call the API as a signed-in local user (real session cookie), as an
 * unauthenticated caller, or with extra options. */
export async function call(f,path,{user='admin@acme.test',method,body,headers={},pass=fixturePasswords.owner,loginAs}={}){
  let cookie='';
  if(user&&loginAs!==false){
    const login=await f.api(request('/api/auth/login',{method:'POST',body:creds(user,pass)}),f.env);
    if(login.status!==200)throw new Error(`login as ${user} failed: ${await login.text()}`);
    cookie=cookieOf(login);
  }
  const verb=method??(body!==undefined?'POST':'GET');
  return f.api(request(path,{method:verb,...(body!==undefined?{body}:{}),...(cookie?{headers:{...headers,cookie}}:{headers})}),f.env);
}

export async function createStaff(f,login,role,pass=fixturePasswords.staff){
  const response=await call(f,'/api/users',{body:{login,displayName:login.split('@')[0],role,[SECRET_FIELD]:pass}});
  if(response.status!==201)throw new Error(`create ${login}: ${await response.text()}`);
  return response.json();
}

/* ---------- commerce builders (synthetic only) ---------- */
const CONTRACT='lumi.commerce.export.v1';
export async function commerceSchemaFingerprint(){const {commerceSchemaFingerprint:fingerprint}=await import('../packages/core/src/commerce-model.ts');return fingerprint();}
export function order(overrides={}) {return {id:'9007199254740993',orderedAt:'2026-09-01T17:00:00.000Z',recognizedAt:'2026-09-03T00:00:00.000Z',state:'accepted',merchandise:'1000000',sellerDiscount:'100000',merchandiseReversal:'180000',cogs:'400000',cogsEvidenceRef:'cost-at-sale-1',variableFees:'80000',shippingIncome:'0',earnedSubsidy:'0',...overrides};}
export function settlement(overrides={}) {return {id:'statement-1',economicAt:'2026-09-10T00:00:00.000Z',dueAt:null,finality:'final',components:[{id:'entitlement',kind:'entitlement',amount:'700000'},{id:'fees',kind:'fee',amount:'-70000'},{id:'reserve',kind:'reserve_addition',amount:'-100000'},{id:'release',kind:'reserve_release',amount:'20000'},{id:'withholding',kind:'withholding',amount:'-30000'}],receipts:[{id:'bank-1',observedAt:'2026-09-11T00:00:00.000Z',amount:'500000',evidenceRef:'bank-statement-1'}],...overrides};}
export function stock(overrides={}) {return {id:'stock-1',poolId:'warehouse-1',variantId:'variant-1',kind:'physical',observedAt:'2026-09-18T00:00:00.000Z',onHand:'13',reserved:'3',available:'10',...overrides};}
export function exportBody(resourceType='orders',rows,overrides={}) {return {contract:CONTRACT,provider:'generic',sourceAccountId:'shop-A',resourceType,currency:'VND',taxBasis:'net-merchandise-actual-cash-v1',timezone:'Asia/Ho_Chi_Minh',window:{from:'2026-09-01T00:00:00.000Z',toExclusive:'2026-09-20T00:00:00.000Z'},observedAt:'2026-09-19T00:00:00.000Z',records:rows??[resourceType==='orders'?order():resourceType==='settlements'?settlement():stock()],...overrides};}
export async function envelope(raw=exportBody(),connectionId='orders-export',deliveryId='delivery-1') {return {eventType:'snapshot',connectionId,sourceAccountId:raw.sourceAccountId,resourceType:raw.resourceType,deliveryId,sourceObjectId:deliveryId,sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:raw.window,schemaFingerprint:await commerceSchemaFingerprint(),rawJson:JSON.stringify(raw)};}

/** Full commerce journey fixture: an owner, an editor and a viewer, one
 * orders connection, one accepted+normalized receipt, and its publication. */
export async function commerceFixture(t){
  const f=await fixture();
  t?.after(()=>f.close());
  await createStaff(f,'editor@acme.test','editor');
  await createStaff(f,'viewer@acme.test','viewer');
  const connect=async(id='orders-export',resource='orders',account='shop-A')=>{
    const response=await call(f,'/api/commerce/connections',{body:{id,provider:'generic',sourceAccountId:account,resourceType:resource,approvalRef:'reviewed-test-export'}});
    if(response.status!==201)throw new Error(`connect: ${await response.text()}`);
    return response.json();
  };
  await connect();
  const accept=async(raw=exportBody(),connectionId='orders-export',deliveryId='delivery-1')=>{
    const response=await call(f,'/api/commerce/receipts',{body:await envelope(raw,connectionId,deliveryId)});
    if(![200,202].includes(response.status))throw new Error(`accept: ${await response.text()}`);
    return response.json();
  };
  const normalize=async(receiptId)=>call(f,'/api/commerce/normalizations',{body:{receiptId}});
  return {...f,connect,accept,normalize};
}
