import type {CustomMetricExtension} from '@runlumi/core/api.ts';

export const customMetricExtensions:readonly CustomMetricExtension[]=[{
 id:'customer.warehouse_hours_saved',version:1,
 async execute({query}){
  const response=await query({metrics:['released_hours'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'});
  const result=response.results[0],value=result?.data[0]?.released_hours;
  return {value:value===null||value===undefined?null:String(value),unit:'hours',evidence:result?.meta??null};
 }
}];
