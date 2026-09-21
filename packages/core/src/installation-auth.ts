import {AppError, type Principal, type Role} from './contracts.ts';
import {hashPassword,verifyPassword} from './password.ts';
import type {Database} from './ports.ts';

export interface InstallationUser { id:string; issuer:string; subject:string; displayName:string; role:Role; state:'active'|'disabled' }
export interface InstallationSession { token:string; cookie:string; user:InstallationUser; expiresAt:string }

const SESSION_TTL_SECONDS=60*60*24*14;
export const SESSION_COOKIE='lumi_session';
const cookieName=SESSION_COOKIE;
const LOCAL_ISSUER='local';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const role=(value:unknown):Role=>{
  if(value==='viewer'||value==='editor'||value==='owner')return value;
  throw new AppError(422,'INVALID_ROLE');
};
const text=(value:unknown,limit:number,label:string):string=>{
  if(typeof value!=='string'||!value.trim()||value.length>limit)throw new AppError(422,`INVALID_${label}`);
  return value.trim();
};
/** Normalize a direct sign-in identifier. Local users sign in by email. */
export function normalizeLogin(value:unknown):string{
  if(typeof value!=='string')throw new AppError(422,'INVALID_LOGIN');
  const login=value.trim().toLowerCase();
  if(!login||login.length>200||!EMAIL.test(login))throw new AppError(422,'INVALID_LOGIN');
  return login;
}
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

/** Count of enabled owner accounts. The last active owner can never be
 * disabled or demoted; recovery of a lost administrator requires restoring a
 * database backup, so accidental loss is prevented here. */
async function activeOwnerCount(db:Database,excludeUserId?:string):Promise<number>{
  const row=await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='owner' AND state='active' AND (? IS NULL OR id!=?)").bind(excludeUserId??null,excludeUserId??null).first<{n:number}>();
  return row?.n??0;
}
export async function assertNotLastActiveOwner(db:Database,userId:string,next:{role?:Role;state?:'active'|'disabled'}):Promise<void>{
  const row=await db.prepare('SELECT role,state FROM users WHERE id=?').bind(userId).first<{role:string;state:string}>();
  if(!row)throw new AppError(404,'USER_NOT_FOUND');
  const losesOwner=(next.role!==undefined&&next.role!=='owner'&&row.role==='owner')||(next.state==='disabled'&&row.state==='active');
  if(losesOwner&&await activeOwnerCount(db,userId)<1)throw new AppError(409,'LAST_ACTIVE_OWNER');
}

/** First-run initialization. Open only while the installation row is absent;
 * the singleton primary key makes concurrent initialization choose one winner
 * and permanent closure follows from the same constraint. */
export async function initializeInstallation(db:Database,input:{name:unknown;coreRelease:unknown;login:unknown;displayName:unknown;password:unknown}):Promise<InstallationUser>{
  const name=text(input.name,160,'INSTALLATION_NAME');
  const coreRelease=text(input.coreRelease,80,'CORE_RELEASE');
  const displayName=text(input.displayName,160,'DISPLAY_NAME');
  const login=normalizeLogin(input.login);
  const password=validatePassword(input.password);
  const now=new Date().toISOString();
  const id=crypto.randomUUID();
  const passwordHash=await hashPassword(password);
  let result;
  try{
    result=await db.batch([
      db.prepare('INSERT INTO installation(singleton,name,initialized_at,core_release) VALUES (1,?,?,?)').bind(name,now,coreRelease),
      db.prepare("INSERT INTO users(id,issuer,subject,display_name,role,state,created_at,updated_at) VALUES (?,'local',?,?, 'owner','active',?,?)").bind(id,login,userDisplayName(displayName,login),now,now),
      db.prepare('INSERT INTO user_credentials(user_id,password_hash,updated_at) VALUES (?,?,?)').bind(id,passwordHash,now)
    ]);
  }catch(error){
    // Re-check: a concurrent winner must read as already-initialized, not as a crash.
    if(await installationInitialized(db))throw new AppError(409,'INSTALLATION_ALREADY_INITIALIZED');
    throw error;
  }
  if(result.some(item=>!item.success))throw new AppError(503,'INSTALLATION_INITIALIZATION_FAILED');
  return {id,issuer:LOCAL_ISSUER,subject:login,displayName:userDisplayName(displayName,login),role:'owner',state:'active'};
}
function userDisplayName(displayName:string,login:string):string{return displayName||(login.split('@')[0]??login);}

function validatePassword(value:unknown):string{
  if(typeof value!=='string'||value.length<10||value.length>200)throw new AppError(422,'PASSWORD_LENGTH');
  if(/^\s|\s$/.test(value))throw new AppError(422,'PASSWORD_SPACES');
  return value;
}

/** Direct password sign-in. Only local credentials authenticate here; an
 * external identity principal never guesses a local password. */
export async function loginInstallation(db:Database,input:{login:unknown;password:unknown}):Promise<InstallationSession>{
  const login=normalizeLogin(input.login);
  if(typeof input.password!=='string'||!input.password.length||input.password.length>200)throw new AppError(401,'INVALID_CREDENTIALS');
  const row=await db.prepare("SELECT id,issuer,subject,display_name,role,state FROM users WHERE issuer='local' AND subject=?").bind(login).first();
  if(!row)throw new AppError(401,'INVALID_CREDENTIALS');
  const user=userFrom(row);
  const credential=await db.prepare('SELECT password_hash FROM user_credentials WHERE user_id=?').bind(user.id).first<{password_hash:string}>();
  if(!credential||!await verifyPassword(input.password,credential.password_hash))throw new AppError(401,'INVALID_CREDENTIALS');
  if(user.state!=='active')throw new AppError(403,'USER_DISABLED');
  return createInstallationSession(db,{issuer:user.issuer,subject:user.subject},user);
}

/** Create a bounded session for a verified identity (password or external IdP). */
export async function createInstallationSession(db:Database,principal:Principal,known?:InstallationUser):Promise<InstallationSession>{
  const user=known??await readInstallationUser(db,principal);
  const token=randomToken();const idHash=await digest(token);const now=new Date();const expires=new Date(now.getTime()+SESSION_TTL_SECONDS*1000).toISOString();
  await db.prepare('INSERT INTO sessions(id_hash,user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)').bind(idHash,user.id,expires,now.toISOString(),now.toISOString()).run();
  return {token,cookie:`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,user,expiresAt:expires};
}

export async function logoutInstallation(db:Database,token:string):Promise<void>{
  if(token&&token.length<=256)await db.prepare('DELETE FROM sessions WHERE id_hash=?').bind(await digest(token)).run();
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

/** Owner-only user management. A newly created local user receives a credential
 * so direct sign-in works immediately. */
export async function upsertInstallationUser(db:Database,input:{id?:unknown;issuer:unknown;subject:unknown;displayName:unknown;role:unknown;state?:unknown;password?:unknown}):Promise<InstallationUser>{
  const issuer=text(input.issuer,200,'ISSUER'),subject=input.issuer===LOCAL_ISSUER?normalizeLogin(input.subject):text(input.subject,200,'SUBJECT');
  const displayName=input.displayName===undefined||input.displayName===null||input.displayName===''?'':text(input.displayName,160,'DISPLAY_NAME');
  const userRole=role(input.role);const state=input.state===undefined?'active':input.state;
  if(state!=='active'&&state!=='disabled')throw new AppError(422,'INVALID_USER_STATE');
  const idValue=input.id===undefined?crypto.randomUUID():text(input.id,80,'USER_ID');const now=new Date().toISOString();
  const storedName=displayName||(subject.split('@')[0]??subject);
  await db.prepare("INSERT INTO users(id,issuer,subject,display_name,role,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(issuer,subject) DO UPDATE SET display_name=excluded.display_name,role=excluded.role,state=excluded.state,updated_at=excluded.updated_at").bind(idValue,issuer,subject,storedName,userRole,state,now,now).run();
  const row=await db.prepare('SELECT id,issuer,subject,display_name,role,state FROM users WHERE issuer=? AND subject=?').bind(issuer,subject).first();
  if(!row)throw new AppError(503,'USER_WRITE_FAILED');
  const user=userFrom(row);
  if(issuer===LOCAL_ISSUER){
    if(input.password!==undefined)await setInstallationCredential(db,user.id,validatePassword(input.password));
    else if(!await db.prepare('SELECT user_id FROM user_credentials WHERE user_id=?').bind(user.id).first())await setInstallationCredential(db,user.id,`reset-${randomToken()}`);
  }
  if(state==='disabled')await revokeInstallationSessions(db,user.id);
  return user;
}

export async function setInstallationCredential(db:Database,userId:string,password:unknown):Promise<void>{
  const validated=validatePassword(password);
  const user=await db.prepare('SELECT id,issuer FROM users WHERE id=?').bind(userId).first<{id:string;issuer:string}>();
  if(!user)throw new AppError(404,'USER_NOT_FOUND');
  if(user.issuer!==LOCAL_ISSUER)throw new AppError(422,'EXTERNAL_IDENTITY_HAS_NO_LOCAL_PASSWORD');
  const hash=await hashPassword(validated);
  await db.prepare("INSERT INTO user_credentials(user_id,password_hash,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at").bind(userId,hash,new Date().toISOString()).run();
}

/** Session-authenticated self password change: requires the current password. */
export async function changeOwnPassword(db:Database,user:InstallationUser,input:{currentPassword:unknown;newPassword:unknown}):Promise<void>{
  if(user.issuer!==LOCAL_ISSUER)throw new AppError(422,'EXTERNAL_IDENTITY_HAS_NO_LOCAL_PASSWORD');
  const credential=await db.prepare('SELECT password_hash FROM user_credentials WHERE user_id=?').bind(user.id).first<{password_hash:string}>();
  if(!credential||typeof input.currentPassword!=='string'||!await verifyPassword(input.currentPassword,credential.password_hash))throw new AppError(403,'INVALID_CREDENTIALS');
  await setInstallationCredential(db,user.id,validatePassword(input.newPassword));
}

export async function setInstallationUserState(db:Database,userId:string,state:'active'|'disabled'):Promise<void>{
  await assertNotLastActiveOwner(db,userId,{state});
  const result=await db.prepare('UPDATE users SET state=?,updated_at=? WHERE id=?').bind(state,new Date().toISOString(),userId).run();
  if((result.meta.changes??0)!==1)throw new AppError(404,'USER_NOT_FOUND');
  if(state==='disabled')await revokeInstallationSessions(db,userId);
}
export async function setInstallationUserRole(db:Database,userId:string,userRole:Role):Promise<InstallationUser>{
  await assertNotLastActiveOwner(db,userId,{role:userRole});
  const result=await db.prepare('UPDATE users SET role=?,updated_at=? WHERE id=?').bind(userRole,new Date().toISOString(),userId).run();
  if((result.meta.changes??0)!==1)throw new AppError(404,'USER_NOT_FOUND');
  const row=await db.prepare('SELECT id,issuer,subject,display_name,role,state FROM users WHERE id=?').bind(userId).first();
  if(!row)throw new AppError(404,'USER_NOT_FOUND');return userFrom(row);
}

export async function authenticateInstallationSession(db:Database,token:string,now=new Date()):Promise<InstallationUser>{
  if(!token||token.length>256)throw new AppError(401,'UNAUTHENTICATED');
  const idHash=await digest(token);
  const row=await db.prepare('SELECT u.id,u.issuer,u.subject,u.display_name,u.role,u.state,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=?').bind(idHash).first<{id:string;issuer:string;subject:string;display_name:string;role:string;state:string;expires_at:string}>();
  if(!row)throw new AppError(401,'UNAUTHENTICATED');
  if(row.expires_at<=now.toISOString()){await db.prepare('DELETE FROM sessions WHERE id_hash=?').bind(idHash).run();throw new AppError(401,'SESSION_EXPIRED');}
  const user=userFrom(row);if(user.state!=='active')throw new AppError(403,'USER_DISABLED');
  await db.prepare('UPDATE sessions SET last_seen_at=? WHERE id_hash=?').bind(now.toISOString(),idHash).run();
  return user;
}

/** Expired sessions are swept opportunistically; expiry is always enforced at
 * read time, so a skipped sweep never extends access. */
export async function pruneExpiredSessions(db:Database,now=new Date()):Promise<void>{
  await db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now.toISOString()).run();
}
export async function revokeInstallationSessions(db:Database,userId:string):Promise<void>{
  await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();
}
export function parseSessionCookie(header:string|null):string|null{
  if(!header)return null;
  for(const part of header.split(';')){const [name,...value]=part.trim().split('=');if(name===cookieName)return value.join('=')||null;}
  return null;
}
