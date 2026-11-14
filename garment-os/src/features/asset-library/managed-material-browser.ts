import { MATERIAL_API } from '@/application/managed-materials';
import type { MaterialPage, MaterialQuery } from '@/types/managed-material';

export const MATERIAL_HOME_QUERY:MaterialQuery={pageNo:1,pageSize:25,status:'0'};
export async function materialApi<T>(path:string,value?:unknown,signal?:AbortSignal):Promise<T>{
  let response:Response;
  try{response=await fetch(path,{method:value===undefined?'GET':'POST',headers:value===undefined?undefined:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal});}
  catch(error){if(error instanceof Error&&error.name==='AbortError')throw error;throw Error('无法连接本地面料服务，请确认工作台已启动。',{cause:error});}
  const data=await response.json().catch(()=>{throw Error('面料服务响应异常。');});
  if(!response.ok)throw Error(typeof data.error==='string'?data.error:'面料查询未完成，请重新查询。');
  return data;
}

// Cache one bounded home page in memory. Navigation and StrictMode reuse the same read.
let home:{endpoint:string;expires:number;promise:Promise<MaterialPage>}|undefined;
export function invalidateMaterialHome(){home=undefined;}
export function loadMaterialHome(endpoint:string):Promise<MaterialPage>{
  if(home?.endpoint===endpoint&&home.expires>Date.now())return home.promise;
  const entry={endpoint,expires:Date.now()+5*60_000,promise:materialApi<MaterialPage>(MATERIAL_API,MATERIAL_HOME_QUERY)};
  home=entry;
  void entry.promise.catch(()=>{if(home===entry)home=undefined;});
  return entry.promise;
}
