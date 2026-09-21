import {verifyRegisteredAccess} from '@runlumi/cloudflare/auth.ts';
import {createControl} from './service.ts';
import type {ControlEnv} from './control-bindings.ts';
// No shared audience: every forwarded JWT is verified against the registered
// deployment's Access team/audience and control interface version, then the
// service re-checks membership, license and lifecycle per requested tenant.
const control=createControl(async(request,env:ControlEnv)=>verifyRegisteredAccess(env.CONTROL_DB,request));
// No public route or workers.dev. Service binding alone is not end-user authentication.
export default {fetch(request:Request,env:ControlEnv){return control(request,env);}};