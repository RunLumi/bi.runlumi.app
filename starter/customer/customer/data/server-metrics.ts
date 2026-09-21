import type {CustomMetricExtension} from '@runlumi/core/api.ts';

/** The extension executes through the core's bounded semantic query compiler.
 * It cannot provide SQL, access a database binding, or bypass tenant scope.
 * NULL-not-zero is the extension's job: an empty database aggregates to a single
 * row ({released_hours:0, matched_rows:0}), which must surface as null, never '0'. */
export const customMetricExtensions:readonly CustomMetricExtension[]=[{
 id:'customer.example_hours_saved',
 version:1,
 async execute({query}){
  const response=await query({metrics:['released_hours'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'});
  const result=response.results[0];
  const row=result?.data[0];
  return {value:row&&row.matched_rows?String(row.released_hours):null,unit:'hours',evidence:result?.meta??null};
 }
}];