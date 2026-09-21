import type {CustomMetricExtension} from '@runlumi/core/api.ts';

export const customMetricExtensions:readonly CustomMetricExtension[]=[{
 id:'customer.channel_margin_note',version:1,
 async execute({query}){
  const response=await query({metrics:['cases'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'});
  const result=response.results[0];
  const row=result?.data[0];
  // NULL-not-zero: an empty database aggregates to {cases:0, matched_rows:0}.
  return {value:row&&row.matched_rows?String(row.cases):null,unit:'count',evidence:result?.meta??null};
 }
}];