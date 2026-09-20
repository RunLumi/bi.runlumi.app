import { AppError, type Principal } from '../../../packages/core/contracts.ts';
// Narrow Access-only verifier, not a general JWT framework. WebCrypto supplies RSA.
// No algorithm negotiation, token-supplied key URL, email-header trust, or dev bypass.
type Jwk = JsonWebKey & {kid?:string};
const cache = new Map<string,{expires:number;keys:Jwk[]}>();
function decode(part:string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new AppError(401,'INVALID_TOKEN');
  try { return Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)); }
  catch { throw new AppError(401,'INVALID_TOKEN'); }
}
function jsonPart(part:string): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(part)));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(401,'INVALID_TOKEN');
  return value as Record<string,unknown>;
}
export async function verifyAccessToken(token:string, team:string, aud:string, fetcher:typeof fetch=fetch, nowSeconds=Math.floor(Date.now()/1000)): Promise<Principal> {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(team) || !/^[A-Za-z0-9_-]{20,128}$/.test(aud) || /REPLACE|example/i.test(team+aud)) throw new AppError(503,'AUTH_NOT_CONFIGURED');
  try {
    if (token.length > 16384) throw new Error('size');
    const parts=token.split('.');
    if (parts.length!==3 || !parts[0] || !parts[1] || !parts[2]) throw new Error('parts');
    const header=jsonPart(parts[0]); const claims=jsonPart(parts[1]);
    if(header.alg!=='RS256' || typeof header.kid!=='string' || header.kid.length>256 || header.crit!==undefined || header.jku!==undefined || header.jwk!==undefined) throw new Error('header');
    const issuer=`https://${team}.cloudflareaccess.com`;
    const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
    if(claims.iss!==issuer || !audiences.every(a=>typeof a==='string') || !audiences.includes(aud) || typeof claims.sub!=='string' || !claims.sub || claims.sub.length>256) throw new Error('claims');
    if(!Number.isSafeInteger(claims.exp) || (claims.exp as number)<=nowSeconds) throw new Error('expired');
    if(claims.nbf!==undefined && (!Number.isSafeInteger(claims.nbf) || (claims.nbf as number)>nowSeconds+30)) throw new Error('not yet valid');
    if(claims.iat!==undefined && (!Number.isSafeInteger(claims.iat) || (claims.iat as number)>nowSeconds+30)) throw new Error('future issue');
    let entry=cache.get(issuer);
    // Deliberately no refresh per unknown kid: prevents attacker-driven fetch storms.
    // Unknown keys fail closed until the bounded cache expires (at most five minutes).
    if(!entry || entry.expires <= nowSeconds) {
      const response=await fetcher(`${issuer}/cdn-cgi/access/certs`,{redirect:'error',signal:AbortSignal.timeout(5000)});
      if(!response.ok) throw new Error('jwks');
      const body=await response.text(); if(body.length>65536) throw new Error('jwks size');
      const payload=JSON.parse(body) as {keys?:Jwk[]};
      if(!Array.isArray(payload.keys) || payload.keys.length>32) throw new Error('jwks keys');
      entry={expires:nowSeconds+300,keys:payload.keys};
      if(cache.size>=8) cache.clear();
      cache.set(issuer,entry);
    }
    const keys=entry.keys.filter(k=>k.kid===header.kid && k.kty==='RSA' && (!k.alg||k.alg==='RS256') && (!k.use||k.use==='sig'));
    if(keys.length!==1) throw new Error('key');
    const key=await crypto.subtle.importKey('jwk',keys[0]!,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if(!valid) throw new Error('signature');
    return {issuer,subject:claims.sub};
  } catch { throw new AppError(401,'UNAUTHENTICATED'); }
}
