import {AppError, type Principal, type Role} from './contracts.ts';
import type {Database} from './ports.ts';

export interface InstallationUser { id:string; issuer:string; subject:string; displayName:string; role:Role; state:'active'|'disabled' }
export interface InstallationSession { token:string; cookie:string; user:InstallationUser; expiresAt:string }

const SESSION_TTL_SECONDS=60*60*24*14;
const cookieName='lumi_session';
const role=(value:unknown):Role=>{
  if(value==='viewer'||value==='editor'||value==='owner')return value;
  throw new AppError(422,'INVALID_ROLE');
};
const text=(value:unknown,limit:number,label:string):string=>{
  if(typeof value!=='string'||!value.trim()||value.length>limit)throw new AppError(422,`INVALID_${label}`);
  return value.trim();
};
async function digest(value:string):Promise<string>{
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function randomToken():string{
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
function userFrom(row:Record<string,unknown>):InstallationUser{
  return {id:String(row.id),issuer:String(row.issuer),subject:String(row.subject),displayName:String(row.display_name),role:role(row.role),state:row.state==='active'?'active':'disabled'};
}
export async function installationInitialized(db:Database):Promise<boolean>{
  const row=await db.prepare('SELECT singleton FROM installation WHERE singleton=1').first();
  return row!==null;
}
export async function initializeInstallation(db:Database,input:{name:unknown;coreRelease:unknown;principal:Principal;displayName:unknown}):Promise<InstallationUser>{
  if(await installationInitialized(db))throw new AppError(409,'INSTALLATION_ALREADY_INITIALIZED');
  const name=text(input.name,160,'INSTALLATION_NAME');
  const coreRelease=text(input.coreRelease,80,'CORE_RELEASE');
  const displayName=text(input.displayName,160,'DISPLAY_NAME');
  const now=new Date().toISOString();
  const id=crypto.randomUUID();
  const user={id,issuer:text(input.principal.issuer,200,'ISSUER'),subject:text(input.principal.subject,200,'SUBJECT'),displayName,role:'owner' as const,state:'active' as const};
  const result=await db.batch([
    db.prepare('INSERT INTO installation(singleton,name,initialized_at,core_release) VALUES (1,?,?,?)').bind(name,now,coreRelease),
    db.prepare('INSERT INTO users(id,issuer,subject,display_name,role,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,user.issuer,user.subject,user.displayName,user.role,user.state,now,now)
  ]);
  if(result.some(item=>!item.success))throw new AppError(503,'INSTALLATION_INITIALIZATION_FAILED');
  return user;
}
export async function createInstallationSession(db:Database,principal:Principal):Promise<InstallationSession>{
  const row=await db.prepare('SELECT id,issuer,subject,display_name,role,state FROM users WHERE issuer=? AND subject=?').bind(principal.issuer,principal.subject).first();
  if(!row)throw new AppError(403,'USER_NOT_FOUND');
  const user=userFrom(row);if(user.state!=='active')throw new AppError(403,'USER_DISABLED');
  const token=randomToken();const idHash=await digest(token);const now=new Date();const expires=new Date(now.getTime()+SESSION_TTL_SECONDS*1000).toISOString();
  await db.prepare('INSERT INTO sessions(id_hash,user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)').bind(idHash,user.id,expires,now.toISOString(),now.toISOString()).run();
  return {token,cookie:`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,user,expiresAt:expires};
}
export async function readInstallationUser(db:Database,principal:Principal):Promise<InstallationUser>{
  const row=await db.prepare('SELECT id,issuer,subject,display_name,role,state FROM users WHERE issuer=? AND subject=?').bind(principal.issuer,principal.subject).first();
  if(!row)throw new AppError(403,'USER_NOT_FOUND');
  const user=userFrom(row);if(user.state!=='active')throw new AppError(403,'USER_DISABLED');return user;
}
export function requireInstallationRole(user:InstallationUser,minimum:Role):void{
  const rank:Record<Role,number>={viewer:1,editor:2,owner:3};
  if(rank[user.role]<rank[minimum])throw new AppError(403,minimum==='owner'?'OWNER_REQUIRED':'EDITOR_REQUIRED');
}
export async function upsertInstallationUser(db:Database,input:{id?:unknown;issuer:unknown;subject:unknown;displayName:unknown;role:unknown;state?:unknown}):Promise<InstallationUser>{
  const issuer=text(input.issuer,200,'ISSUER'),subject=text(input.subject,200,'SUBJECT'),displayName=text(input.displayName,160,'DISPLAY_NAME');
  const userRole=role(input.role);const state=input.state===undefined?'active':input.state;
  if(state!=='active'&&state!=='disabled')throw new AppError(422,'INVALID_USER_STATE');
  const idValue=input.id===undefined?crypto.randomUUID():text(input.id,80,'USER_ID');const now=new Date().toISOString();
  await db.prepare('INSERT INTO users(id,issuer,subject,display_name,role,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(issuer,subject) DO UPDATE SET display_name=excluded.display_name,role=excluded.role,state=excluded.state,updated_at=excluded.updated_at').bind(idValue,issuer,subject,displayName,userRole,state,now,now).run();
  const row=await db.prepare('SELECT id,issuer,subject,display_name,role,state FROM users WHERE issuer=? AND subject=?').bind(issuer,subject).first();
  if(!row)throw new AppError(503,'USER_WRITE_FAILED');return userFrom(row);
}
export async function authenticateInstallationSession(db:Database,token:string,now=new Date()):Promise<InstallationUser>{
  if(!token||token.length>256)throw new AppError(401,'UNAUTHENTICATED');
  const idHash=await digest(token);
  const row=await db.prepare('SELECT u.id,u.issuer,u.subject,u.display_name,u.role,u.state FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>?').bind(idHash,now.toISOString()).first();
  if(!row)throw new AppError(401,'UNAUTHENTICATED');
  const user=userFrom(row);if(user.state!=='active')throw new AppError(403,'USER_DISABLED');
  await db.prepare('UPDATE sessions SET last_seen_at=? WHERE id_hash=?').bind(now.toISOString(),idHash).run();
  return user;
}
export async function revokeInstallationSessions(db:Database,userId:string):Promise<void>{
  await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();
}
export function parseSessionCookie(header:string|null):string|null{
  if(!header)return null;
  for(const part of header.split(';')){const [name,...value]=part.trim().split('=');if(name===cookieName)return value.join('=')||null;}
  return null;
}
