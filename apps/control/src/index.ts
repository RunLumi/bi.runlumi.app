import {verifyAccessToken} from '../../api/src/auth.ts';
import {createControl} from './service.ts';
import type {ControlEnv} from './bindings.ts';
const control=createControl(async(request,env)=>verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',env.ACCESS_TEAM,env.ACCESS_AUD));
// No public route or workers.dev. Service binding alone is not end-user authentication.
export default {fetch(request:Request,env:ControlEnv){return control(request,env);}};
