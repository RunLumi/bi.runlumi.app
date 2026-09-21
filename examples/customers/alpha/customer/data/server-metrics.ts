import type {CustomMetricExtension} from '@runlumi/core/api.ts';

export const customMetricExtensions:readonly CustomMetricExtension[]=[{
 id:'customer.warehouse_hours_saved',version:1,
 async execute({query}){
  const response=await query({metrics:['released_hours'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'});
  const result=response.results[0];
  const row=result?.data[0];
  // NULL-not-zero: an empty database aggregates to {released_hours:0, matched_rows:0}.
  return {value:row&&row.matched_rows?String(row.released_hours):null,unit:'hours',evidence:result?.meta??null};
 }
}];