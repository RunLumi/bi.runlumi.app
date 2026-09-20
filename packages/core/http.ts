import {AppError} from './contracts.ts';
export async function readJson(request:Request,max=65536):Promise<unknown>{
  if(request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')throw new AppError(415,'JSON_REQUIRED');
  if(!request.body)throw new AppError(400,'BODY_REQUIRED');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new AppError(413,'BODY_TOO_LARGE');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new AppError(400,'INVALID_JSON');}
}
export function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}
export function revision(request:Request):number{const v=request.headers.get('if-match');if(!v||!/^"\d{1,9}"$/.test(v))throw new AppError(428,'REVISION_REQUIRED');return Number(v.slice(1,-1));}
