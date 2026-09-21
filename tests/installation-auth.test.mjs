import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalDatabase} from '../scripts/local-adapters.mjs';
import {initializeInstallation,installationInitialized,createInstallationSession,authenticateInstallationSession,revokeInstallationSessions,parseSessionCookie} from '../packages/core/src/installation-auth.ts';

async function db(){const d=new LocalDatabase();const {readFile}=await import('node:fs/promises');d.db.exec(await readFile(new URL('../migrations/installation/0001_initial.sql',import.meta.url),'utf8'));return d;}
const principal={issuer:'local-test',subject:'admin'};
test('installation auth initializes once and revocation follows local user state',async()=>{
 const d=await db();try{
  assert.equal(await installationInitialized(d),false);
  const user=await initializeInstallation(d,{name:'Acme BI',coreRelease:'0.1.0',principal,displayName:'Admin'});
  assert.equal(user.role,'owner');assert.equal(await installationInitialized(d),true);
  await assert.rejects(()=>initializeInstallation(d,{name:'Again',coreRelease:'0.1.0',principal,displayName:'Admin'}),e=>e.code==='INSTALLATION_ALREADY_INITIALIZED');
  const session=await createInstallationSession(d,principal);assert.equal(parseSessionCookie(session.cookie),session.token);
  assert.equal((await authenticateInstallationSession(d,session.token)).id,user.id);
  await d.db.prepare("UPDATE users SET state='disabled' WHERE id=?").run(user.id);
  await assert.rejects(()=>authenticateInstallationSession(d,session.token),e=>e.code==='USER_DISABLED');
  await revokeInstallationSessions(d,user.id);
 }finally{d.close();}
});
