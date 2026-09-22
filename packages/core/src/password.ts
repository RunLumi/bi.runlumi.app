import {AppError} from './contracts.ts';

/** Password credential format: pbkdf2-sha256 with a per-user random salt.
 * The count is the production Workers runtime ceiling: it rejects PBKDF2
 * above 100,000 iterations (NotSupportedError), and local workerd does not
 * enforce that cap. It is stored per credential, so a future version can
 * raise it without invalidating existing hashes. Verification is constant-time. */
const ALGORITHM='pbkdf2-sha256';
export const PBKDF2_ITERATIONS=100_000;
const SALT_BYTES=16;
const KEY_BYTES=32;
const MIN_PASSWORD_LENGTH=10;
const MAX_PASSWORD_LENGTH=200;

export function validatePasswordStrength(value:unknown):string{
 if(typeof value!=='string'||value.length<MIN_PASSWORD_LENGTH||value.length>MAX_PASSWORD_LENGTH)throw new AppError(422,'PASSWORD_LENGTH');
 if(/^\s|\s$/.test(value))throw new AppError(422,'PASSWORD_SPACES');
 if(/^(?:password|passphrase|1234567890|qwertyuiop|letmein123)/i.test(value))throw new AppError(422,'PASSWORD_REJECTED');
 return value;
}

async function derive(password:string,salt:Uint8Array,iterations:number):Promise<Uint8Array>{
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt as BufferSource,iterations},key,KEY_BYTES*8);
 return new Uint8Array(bytes);
}
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const unb64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));

export async function hashPassword(password:string):Promise<string>{
 const salt=new Uint8Array(SALT_BYTES);crypto.getRandomValues(salt);
 const derived=await derive(password,salt,PBKDF2_ITERATIONS);
 return `${ALGORITHM}$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(derived)}`;
}

export async function verifyPassword(password:string,stored:unknown):Promise<boolean>{
 if(typeof stored!=='string')return false;
 const parts=stored.split('$');
 if(parts.length!==4||parts[0]!==ALGORITHM)throw new AppError(503,'CREDENTIAL_FORMAT_UNSUPPORTED');
 const iterations=Number(parts[1]);
 if(!Number.isSafeInteger(iterations)||iterations<1||iterations>10_000_000)throw new AppError(503,'CREDENTIAL_FORMAT_UNSUPPORTED');
 let salt:Uint8Array,expected:Uint8Array;
 try{salt=unb64(parts[2]!);expected=unb64(parts[3]!);}catch{throw new AppError(503,'CREDENTIAL_FORMAT_UNSUPPORTED');}
 const actual=await derive(password,salt,iterations);
 if(actual.length!==expected.length)return false;
 let difference=0;
 for(let i=0;i<actual.length;i++)difference|=actual[i]!^expected[i]!;
 return difference===0;
}
