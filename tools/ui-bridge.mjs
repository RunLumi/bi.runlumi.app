// Optional offline UI validation transport. Never imported by the Worker.
import readline from 'node:readline';
import {fixture,request} from '../scripts/local-adapters.mjs';
const f=await fixture();
console.log(JSON.stringify({ready:true}));
for await(const line of readline.createInterface({input:process.stdin})){
 try{
  const {path,options={}}=JSON.parse(line);
  const headers=Object.fromEntries(new Headers(options.headers??{}));
  const response=await f.api(request(path,{method:options.method??'GET',user:headers['x-demo-user']??'alpha-owner',headers,...(options.body?{body:JSON.parse(options.body)}:{})}),f.env);
  console.log(JSON.stringify({status:response.status,body:await response.json()}));
 }catch(e){console.log(JSON.stringify({status:500,body:{error:{code:'UI_BRIDGE_ERROR'}}}));}
}
f.close();
