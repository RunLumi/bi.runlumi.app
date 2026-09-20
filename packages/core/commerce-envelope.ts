import {AppError,id,object,text} from './contracts.ts';

/** Owner-uploaded evidence, not a verified vendor webhook or canonical commerce row. */
export interface ExportEnvelope {
 connectionId:string; sourceAccountId:string; resourceType:'orders'|'settlements'|'inventory';
 deliveryId:string; sourceObjectId:string; sourceRevision:string|null;
 sourceEventAt:string|null; sourceUpdatedAt:string|null;
 window:{from:string;toExclusive:string}; schemaFingerprint:string; rawJson:string;
}
function instant(value:unknown):string {
 const s=text(value,24);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)throw new AppError(400,'INVALID_SOURCE_INSTANT');
 return s;
}
export function parseExportEnvelope(value:unknown):ExportEnvelope {
 const b=object(value,['connectionId','sourceAccountId','resourceType','deliveryId','sourceObjectId','sourceRevision','sourceEventAt','sourceUpdatedAt','window','schemaFingerprint','rawJson']);
 const connectionId=id(b.connectionId),sourceAccountId=text(b.sourceAccountId,128),deliveryId=text(b.deliveryId,128),sourceObjectId=text(b.sourceObjectId,128);
 if(!['orders','settlements','inventory'].includes(String(b.resourceType)))throw new AppError(400,'INVALID_RESOURCE_TYPE');
 const w=object(b.window,['from','toExclusive']);const from=instant(w.from),toExclusive=instant(w.toExclusive);
 if(from>=toExclusive||Date.parse(toExclusive)-Date.parse(from)>366*86_400_000)throw new AppError(400,'INVALID_SOURCE_WINDOW');
 if(typeof b.schemaFingerprint!=='string'||!/^sha256:[a-f0-9]{64}$/.test(b.schemaFingerprint))throw new AppError(400,'SCHEMA_FINGERPRINT_REQUIRED');
 if(typeof b.rawJson!=='string'||!b.rawJson.length)throw new AppError(400,'RAW_JSON_REQUIRED');
 if(new TextEncoder().encode(b.rawJson).byteLength>48_000)throw new AppError(413,'RAW_EXPORT_TOO_LARGE');
 try{const raw:unknown=JSON.parse(b.rawJson);if(!raw||typeof raw!=='object')throw new Error();}catch{throw new AppError(400,'INVALID_RAW_JSON');}
 return {connectionId,sourceAccountId,resourceType:b.resourceType as ExportEnvelope['resourceType'],deliveryId,sourceObjectId,
  sourceRevision:b.sourceRevision===null?null:text(b.sourceRevision,128),sourceEventAt:b.sourceEventAt===null?null:instant(b.sourceEventAt),sourceUpdatedAt:b.sourceUpdatedAt===null?null:instant(b.sourceUpdatedAt),
  window:{from,toExclusive},schemaFingerprint:b.schemaFingerprint,rawJson:b.rawJson};
}
