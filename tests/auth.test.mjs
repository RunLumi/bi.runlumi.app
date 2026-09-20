import test from 'node:test';import assert from 'node:assert/strict';import {verifyAccessToken} from '../apps/api/src/auth.ts';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicKey={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'k1',alg:'RS256',use:'sig'};
const aud='a'.repeat(64),now=2000000000;
const encode=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
async function token(claims={},header={}){const input=`${encode({alg:'RS256',kid:'k1',...header})}.${encode({iss:'https://testteam.cloudflareaccess.com',sub:'employee-1',aud:[aud],exp:now+3600,iat:now,...claims})}`;const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input));return `${input}.${Buffer.from(sig).toString('base64url')}`;}
const fetcher=async url=>{assert.equal(url,'https://testteam.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[publicKey]});};
test('valid RS256 Access token verifies against fixed issuer and audience',async()=>assert.deepEqual(await verifyAccessToken(await token(),'testteam',aud,fetcher,now),{issuer:'https://testteam.cloudflareaccess.com',subject:'employee-1'}));
for(const claims of [{exp:now},{exp:'2090000000'},{aud:['wrong']},{iss:'https://evil.invalid'},{sub:''},{nbf:now+100},{iat:now+100}])test(`invalid claims fail closed ${JSON.stringify(claims)}`,async()=>assert.rejects(()=>token(claims).then(t=>verifyAccessToken(t,'testteam',aud,fetcher,now))));
for(const header of [{alg:'none'},{alg:'HS256'},{kid:'unknown'},{jku:'https://evil.invalid'},{crit:['b64']}])test(`invalid headers fail closed ${JSON.stringify(header)}`,async()=>assert.rejects(()=>token({},header).then(t=>verifyAccessToken(t,'testteam',aud,fetcher,now))));
test('tampered payload fails signature',async()=>{const t=await token();const p=t.split('.');p[1]=encode({iss:'https://testteam.cloudflareaccess.com',sub:'attacker',aud:[aud],exp:now+3600});await assert.rejects(()=>verifyAccessToken(p.join('.'),'testteam',aud,fetcher,now));});
test('missing token and malformed configuration fail closed',async()=>{await assert.rejects(()=>verifyAccessToken('','testteam',aud,fetcher,now));await assert.rejects(()=>verifyAccessToken('x','https://evil.invalid',aud,fetcher,now));});
