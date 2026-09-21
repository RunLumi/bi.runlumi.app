import {AppError,type Principal} from '@runlumi/core/contracts.ts';
import {authenticateInstallationSession,parseSessionCookie,readInstallationUser,type InstallationUser} from '@runlumi/core/installation-auth.ts';
import type {AppEnv,Database} from '@runlumi/core/ports.ts';
import {verifyAccessToken} from './auth.ts';

/** Composition order for one installation:
 * 1. an application session cookie (direct password sign-in), then
 * 2. an optional Cloudflare Access JWT, when the operator configured one.
 * Everything else fails closed. Demo headers are never consulted here, so a
 * production deployment can never authenticate on a header value. */
const PLACEHOLDER=/REPLACE|example|^$|^change/i;
function accessConfigured(team:unknown,audience:unknown):boolean{
 if(typeof team!=='string'||typeof audience!=='string')return false;
 return team.length>0&&audience.length>=20&&!PLACEHOLDER.test(team+audience);
}
export async function authenticateInstallation<E extends AppEnv>(request:Request,env:E):Promise<InstallationUser|Principal>{
 const db=(env.DB??env.SERVING) as Database|undefined;
 if(!db||typeof db.prepare!=='function')throw new AppError(503,'INSTALLATION_DATABASE_UNAVAILABLE');
 const cookie=parseSessionCookie(request.headers.get('cookie'));
 if(cookie)return authenticateInstallationSession(db,cookie);
 if(accessConfigured(env.ACCESS_TEAM,env.ACCESS_AUD))return verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',String(env.ACCESS_TEAM),String(env.ACCESS_AUD));
 throw new AppError(401,'UNAUTHENTICATED');
}
