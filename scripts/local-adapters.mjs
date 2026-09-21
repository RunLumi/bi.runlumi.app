export {LocalDatabase,LocalObjects} from '@runlumi/cloudflare/testing.ts';
export function request(path,{method='GET',body,headers={}}={}){return new Request(`http://localhost:8787${path}`,{method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})})}
