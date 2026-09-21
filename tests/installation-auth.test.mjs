import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyInstallation,fixture,call,cookieOf,request,createStaff,creds,fixturePasswords,SECRET_FIELD} from './helpers.mjs';
import {installationInitialized,initializeInstallation,loginInstallation,authenticateInstallationSession,parseSessionCookie,setInstallationCredential,changeOwnPassword,setInstallationUserState,setInstallationUserRole,readInstallationUser,createInstallationSession} from '../packages/core/src/installation-auth.ts';
import {hashPassword,verifyPassword} from '../packages/core/src/password.ts';

test('password hashing is salted, verifiable, and rejects wrong secrets',async()=>{
 const hash=await hashPassword('correct horse battery');
 assert.match(hash,/^pbkdf2-sha256\$\d+\$/);
 assert.notEqual(hash,await hashPassword('correct horse battery'),'salt must differ per hash');
 assert.equal(await verifyPassword('correct horse battery',hash),true);
 assert.equal(await verifyPassword('wrong password',hash),false);
 await assert.rejects(()=>verifyPassword('x','bcrypt$junk'),e=>e.code==='CREDENTIAL_FORMAT_UNSUPPORTED');
});

test('initialization stores a password credential, runs once, and closes permanently',async()=>{
 const d=await emptyInstallation();try{
  assert.equal(await installationInitialized(d),false);
  const user=await initializeInstallation(d,{name:'Acme BI',coreRelease:'0.1.0',login:'admin@acme.test',displayName:'Admin',[SECRET_FIELD]:fixturePasswords.owner});
  assert.equal(user.role,'owner');assert.equal(await installationInitialized(d),true);
  const credential=d.db.prepare('SELECT password_hash FROM user_credentials WHERE user_id=?').get(user.id);
  assert.ok(credential&&await verifyPassword('owner-password-1',credential.password_hash));
  await assert.rejects(()=>initializeInstallation(d,{name:'Again',coreRelease:'0.1.0',login:'admin@acme.test',displayName:'Admin',[SECRET_FIELD]:fixturePasswords.owner}),e=>e.code==='INSTALLATION_ALREADY_INITIALIZED');
  await assert.rejects(()=>initializeInstallation(d,{name:'Weak',coreRelease:'0.1.0',login:'weak@acme.test',displayName:'W',password:'short'}),e=>e.code==='PASSWORD_LENGTH');
  await assert.rejects(()=>initializeInstallation(d,{name:'Bad',coreRelease:'0.1.0',login:'not-an-email',displayName:'B',[SECRET_FIELD]:fixturePasswords.owner}),e=>e.code==='INVALID_LOGIN');
 }finally{d.close();}
});

test('direct sign-in: exact password required, disabled users rejected, sessions bounded and revocable',async()=>{
 const f=await fixture();try{
  await assert.rejects(()=>loginInstallation(f.db,{login:'admin@acme.test',[SECRET_FIELD]:'wrong-password-value'}),e=>e.code==='INVALID_CREDENTIALS');
  await assert.rejects(()=>loginInstallation(f.db,{login:'nobody@acme.test',[SECRET_FIELD]:fixturePasswords.owner}),e=>e.code==='INVALID_CREDENTIALS');
  const session=await loginInstallation(f.db,{login:'admin@acme.test',[SECRET_FIELD]:fixturePasswords.owner});
  assert.equal(parseSessionCookie(session.cookie),session.token);
  assert.ok(Date.parse(session.expiresAt)>Date.now()+13*24*3600_000,'session lifetime must be bounded near 14 days');
  assert.equal((await authenticateInstallationSession(f.db,session.token)).subject,'admin@acme.test');
  await assert.rejects(()=>authenticateInstallationSession(f.db,'forged-token-value'),e=>e.code==='UNAUTHENTICATED');
  await createStaff(f,'staff@acme.test','editor');
  const staffSession=await loginInstallation(f.db,{login:'staff@acme.test',[SECRET_FIELD]:fixturePasswords.staff});
  await setInstallationUserState(f.db,(await readInstallationUser(f.db,{issuer:'local',subject:'staff@acme.test'})).id,'disabled');
  await assert.rejects(()=>authenticateInstallationSession(f.db,staffSession.token),e=>e.code==='UNAUTHENTICATED','disabling a user must revoke sessions');
  await assert.rejects(()=>loginInstallation(f.db,{login:'staff@acme.test',[SECRET_FIELD]:fixturePasswords.staff}),e=>e.code==='USER_DISABLED');
 }finally{f.close();}
});

test('the last active owner can never be disabled or demoted',async()=>{
 const f=await fixture();try{
  const owner=await readInstallationUser(f.db,{issuer:'local',subject:'admin@acme.test'});
  await assert.rejects(()=>setInstallationUserState(f.db,owner.id,'disabled'),e=>e.code==='LAST_ACTIVE_OWNER');
  await assert.rejects(()=>setInstallationUserRole(f.db,owner.id,'viewer'),e=>e.code==='LAST_ACTIVE_OWNER');
  await createStaff(f,'second-owner@acme.test','owner');
  const second=await readInstallationUser(f.db,{issuer:'local',subject:'second-owner@acme.test'});
  await setInstallationUserState(f.db,owner.id,'disabled');
  await assert.rejects(()=>setInstallationUserState(f.db,second.id,'disabled'),e=>e.code==='LAST_ACTIVE_OWNER','one active owner must remain');
  await assert.rejects(()=>setInstallationUserRole(f.db,second.id,'editor'),e=>e.code==='LAST_ACTIVE_OWNER');
 }finally{f.close();}
});

test('self password change requires the current password; owner reset works for staff',async()=>{
 const f=await fixture();try{
  await createStaff(f,'staff@acme.test','editor');
  const staff=await readInstallationUser(f.db,{issuer:'local',subject:'staff@acme.test'});
  await assert.rejects(()=>changeOwnPassword(f.db,staff,{currentPassword:'nope-wrong',newPassword:fixturePasswords.changed}),e=>e.code==='INVALID_CREDENTIALS');
  await changeOwnPassword(f.db,staff,{currentPassword:fixturePasswords.staff,newPassword:fixturePasswords.changed});
  const session=await loginInstallation(f.db,{login:'staff@acme.test',[SECRET_FIELD]:fixturePasswords.changed});
  assert.ok(session.token);
  await setInstallationCredential(f.db,staff.id,'owner-reset-password-3');
  assert.ok((await loginInstallation(f.db,{login:'staff@acme.test',[SECRET_FIELD]:fixturePasswords.reset})).token);
  await assert.rejects(()=>setInstallationCredential(f.db,staff.id,'x'),e=>e.code==='PASSWORD_LENGTH');
 }finally{f.close();}
});

test('expired sessions fail closed',async()=>{
 const d=await emptyInstallation();try{
  await initializeInstallation(d,{name:'A',coreRelease:'0',login:'a@a.test',displayName:'A',[SECRET_FIELD]:fixturePasswords.owner});
  const session=await createInstallationSession(d,{issuer:'local',subject:'a@a.test'});
  const beyondTtl=new Date(Date.parse(session.expiresAt)+1000);
  await assert.rejects(()=>authenticateInstallationSession(d,session.token,beyondTtl),e=>e.code==='SESSION_EXPIRED');
  assert.equal(d.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0,'expired sessions are removed when touched');
 }finally{d.close();}
});

test('API setup journey: status, token protection, takeover closure, concurrent init chooses one winner',async()=>{
 {const f=await fixture({seed:false});try{
  const status=await f.api(request('/api/setup/status'),f.env);assert.equal((await status.json()).initialized,false);
  const withoutToken=await f.api(request('/api/setup',{method:'POST',body:{name:'A',login:'a@a.test',displayName:'A',[SECRET_FIELD]:fixturePasswords.owner}}),f.env);
  assert.equal(withoutToken.status,403);assert.equal((await withoutToken.json()).error.code,'SETUP_TOKEN_REQUIRED');
  const setup=await f.api(request('/api/setup',{method:'POST',body:{name:'A',login:'a@a.test',displayName:'A',[SECRET_FIELD]:fixturePasswords.owner,setupToken:'setup-token-xyz'}}),f.env);
  if(setup.status!==201)throw new Error(await setup.text());
  assert.match(setup.headers.get('set-cookie')??'',/^lumi_session=/);
  const takeover=await f.api(request('/api/setup',{method:'POST',body:{name:'B',login:'evil@evil.test',displayName:'E',[SECRET_FIELD]:fixturePasswords.attacker,setupToken:'setup-token-xyz'}}),f.env);
  assert.equal(takeover.status,409);assert.equal((await takeover.json()).error.code,'INSTALLATION_ALREADY_INITIALIZED');
  const statusAfter=await f.api(request('/api/setup/status'),f.env);assert.equal((await statusAfter.json()).initialized,true);
  const anon=await f.api(request('/api/session'),f.env);
  assert.ok([401,403].includes(anon.status),'an anonymous caller must fail closed');
 }finally{f.close();}}
 {const f=await fixture({seed:false});try{
  const results=await Promise.all([
   f.api(request('/api/setup',{method:'POST',body:{name:'Racer A',login:'a@a.test',displayName:'A',[SECRET_FIELD]:fixturePasswords.owner,setupToken:'setup-token-xyz'}}),f.env),
   f.api(request('/api/setup',{method:'POST',body:{name:'Racer B',login:'b@b.test',displayName:'B',[SECRET_FIELD]:fixturePasswords.second,setupToken:'setup-token-xyz'}}),f.env)
  ]);
  const statuses=results.map(r=>r.status).sort();
  assert.deepEqual(statuses,[201,409],'exactly one concurrent initialization wins');
  assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM installation').get().n,1);
  assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM users').get().n,1);
 }finally{f.close();}}
});

test('session endpoints: login sets cookie, session reads user, logout clears it, cross-site writes are denied',async()=>{
 const f=await fixture();try{
  const login=await f.api(request('/api/auth/login',{method:'POST',body:{login:'admin@acme.test',[SECRET_FIELD]:fixturePasswords.owner}}),f.env);
  assert.equal(login.status,200);const cookie=cookieOf(login);
  const session=await f.api(request('/api/session',{headers:{cookie}}),f.env);
  assert.equal(session.status,200);const body=await session.json();
  assert.equal(body.user.subject,'admin@acme.test');assert.equal(body.user.role,'owner');assert.equal(body.demo,false);
  const badOrigin=await f.api(request('/api/query',{method:'POST',headers:{cookie,origin:'https://evil.example'},body:{metrics:['cases'],from:'2026-09-01',to:'2026-09-02',groupBy:'none'}}),f.env);
  assert.equal(badOrigin.status,403);assert.equal((await badOrigin.json()).error.code,'CROSS_ORIGIN_DENIED');
  const logout=await f.api(request('/api/auth/logout',{method:'POST',headers:{cookie}}),f.env);
  assert.equal(logout.status,200);
  const afterLogout=await f.api(request('/api/session',{headers:{cookie}}),f.env);
  assert.equal(afterLogout.status,401);
  const wrongPassword=await f.api(request('/api/auth/login',{method:'POST',body:{login:'admin@acme.test',[SECRET_FIELD]:'not-my-password'}}),f.env);
  assert.equal(wrongPassword.status,401);assert.equal((await wrongPassword.json()).error.code,'INVALID_CREDENTIALS');
 }finally{f.close();}
});
