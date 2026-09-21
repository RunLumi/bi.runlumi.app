import type {CustomMetricExtension} from '@runlumi/core/api.ts';

/** The extension executes through the core's bounded semantic query compiler.
 * It cannot provide SQL, access a database binding, or bypass tenant scope. */
export const customMetricExtensions:readonly CustomMetricExtension[]=[{
 id:'customer.example_hours_saved',
 version:1,
 async execute({query}){
  const response=await query({metrics:['released_hours'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'});
  const result=response.results[0];
  const raw=result?.data[0]?.released_hours;
  return {value:raw===null||raw===undefined?null:String(raw),unit:'hours',evidence:result?.meta??null};
 }
}];
