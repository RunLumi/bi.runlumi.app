import type {CustomMetricExtension} from '@runlumi/core/api.ts';

export const customMetricExtensions:readonly CustomMetricExtension[]=[{
 id:'customer.channel_margin_note',version:1,
 async execute({query}){
  const response=await query({metrics:['case_count'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'});
  const result=response.results[0],value=result?.data[0]?.case_count;
  return {value:value===null||value===undefined?null:String(value),unit:'count',evidence:result?.meta??null};
 }
}];
