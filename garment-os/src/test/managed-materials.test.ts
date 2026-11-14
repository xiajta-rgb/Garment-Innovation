import { expect, it, vi } from 'vitest';
import { canAssignMaterial, materialRpcBody, materialValue, parseMaterialResponse, readManagedAssignments, readMaterialQuery } from '@/application/managed-materials';
import { createMaterialService } from '../../server/material-plugin';
import { createDesignStore } from '@/store/designStore';
import { createIndexedDbDesignRepository } from '@/lib/db/design-repository';
import { IDBFactory } from 'fake-indexeddb';
import type { ManagedMaterial } from '@/types/managed-material';

const fixture:ManagedMaterial={materialId:'1739493085997006850',materialCode:'TEST-ONLY',materialName:'测试面料',status:0,materialType:'M',ingredients:null,rangeWidth:'173',gramWeight:'180',purchasePrice:null,hasCorrespondGreyFabric:false};
const rpc=(body:unknown,isError=false)=>({jsonrpc:'2.0',id:'test',result:{isError,content:[{type:'text',text:JSON.stringify(body)}]}});
it('query keeps exact int64 and uses only declared MCP parameters and codes',()=>{
  const q=readMaterialQuery({pageNo:2,pageSize:25,materialId:fixture.materialId,status:'0',season:'Z3',materialName:' 测试 '});
  expect(readMaterialQuery({materialId:'-9223372036854775808'}).materialId).toBe('-9223372036854775808');
  expect(q.materialName).toBe('测试');const raw=materialRpcBody(q,'test');
  expect(raw).toContain('"materialId":1739493085997006850');expect(raw).not.toContain('"materialId":"');
  expect(JSON.parse(raw).params).toMatchObject({name:'basedata.material.list',version:'1',arguments:{status:'0',season:'Z3',pageNo:2,pageSize:25}});
  for(const bad of [{pageSize:1001},{pageNo:0},{pageSize:1.5},{materialId:1739493085997006850},{materialId:'9223372036854775808'},{status:0},{season:'针织通用'},{productType:'tshirt'},{fabricFunction:'a'.repeat(51)}])expect(()=>readMaterialQuery(bad)).toThrow();
});
it('response preserves nulls, booleans, zero and string IDs without fabricating totals or units',()=>{
  const a=parseMaterialResponse(rpc([{...fixture,purchasePrice:0}]),'test')[0];
  expect(a.materialId).toBe(fixture.materialId);expect(a.ingredients).toBeNull();expect(a.purchasePrice).toBe(0);expect(a.hasCorrespondGreyFabric).toBe(false);
  expect(materialValue('ingredients',null)).toBe('未提供');expect(materialValue('purchasePrice',0)).toBe('0');expect(materialValue('hasCorrespondGreyFabric',false)).toBe('否');expect(materialValue('unit','KG')).toBe('公斤');expect(materialValue('gramWeight',a.gramWeight)).toBe('180');
  expect(parseMaterialResponse(rpc(null))).toEqual([]);expect(parseMaterialResponse(rpc([]))).toEqual([]);
  expect(parseMaterialResponse(rpc([{...fixture,materialId:57}]))[0].materialId).toBe('57');
});
it('HTTP-200 protocol errors, tool errors and malformed business data fail closed',()=>{
  const failures=[{error:{message:'协议失败'}},rpc({errorCode:'FORBIDDEN',errorMessage:'没有查询权限'},true),rpc({data:{list:[fixture]}}),rpc([{...fixture,materialId:1739493085997006850}]),rpc([fixture,fixture]),{result:{content:[{type:'text',text:'invalid'}]}},rpc([{...fixture,hasCorrespondGreyFabric:0}])];
  failures.forEach(v=>expect(()=>parseMaterialResponse(v)).toThrow());expect(()=>parseMaterialResponse(rpc([]),'other')).toThrow('编号');
  expect(()=>parseMaterialResponse(rpc({errorMessage:'Authorization Bearer fake-secret'},true))).toThrow('面料查询失败');
});
it('credentials stay server-only, endpoint changes require new credentials, and errors redact secrets',async()=>{
  const secret='fixture-private-credential';
  const fetcher=vi.fn(async(_url:string,options:RequestInit)=>{const id=JSON.parse(options.body as string).id;return new Response(JSON.stringify({...rpc([fixture]),id}),{headers:{'content-type':'application/json'}});});
  const service=createMaterialService({MCP_ACCESS_TOKEN:secret},fetcher as typeof fetch);
  expect(JSON.stringify(service.status())).not.toContain(secret);
  expect(()=>service.configure({endpoint:'https://other.example/mcp'})).toThrow('凭证');
  const page=await service.query({pageSize:1});expect(page.total).toBeNull();expect(page.mayHaveNext).toBe(true);expect(page.items).toEqual([fixture]);
  expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1].redirect).toBe('error');
  expect((fetcher.mock.calls[0][1].headers as Record<string,string>).Authorization).toBe('Bearer '+secret);
  expect(JSON.stringify(page)).not.toContain(secret);service.configure({clear:true});await expect(service.query({})).rejects.toMatchObject({status:401});
});
it.each([401,403,500])('handles HTTP %i without exposing upstream response text',async status=>{
  const service=createMaterialService({MCP_ACCESS_TOKEN:'fixture-private'},vi.fn(async()=>new Response('Authorization: sensitive',{status})) as typeof fetch);
  await expect(service.query({})).rejects.toMatchObject({status:status===500?502:status});await expect(service.query({})).rejects.not.toThrow('sensitive');
});
it('timeouts and event-stream results follow the same checked business schema',async()=>{
  const timeout=createMaterialService({MCP_ACCESS_TOKEN:'test'},vi.fn(async()=>{throw new DOMException('private','TimeoutError');}) as typeof fetch);
  await expect(timeout.query({})).rejects.toMatchObject({status:504});
  const service=createMaterialService({MCP_ACCESS_TOKEN:'test'},vi.fn(async(_u,options)=>new Response('event: message\ndata: '+JSON.stringify({...rpc([fixture]),id:JSON.parse(options!.body as string).id})+'\n\n',{headers:{'content-type':'text/event-stream'}})) as typeof fetch);
  expect((await service.query({})).items).toEqual([fixture]);
});
it('association changes no CAD, supports undo/redo/save/load, and new designs clear it',async()=>{
  const store=createDesignStore({repository:createIndexedDbDesignRepository(()=>new IDBFactory())});
  const draft=store.getState().draft,assign={source:'basedata.material.list' as const,version:'1' as const,endpoint:'https://mcp.lasensys.com/mcp',fetchedAt:'2026-11-12T10:00:00Z',material:fixture};
  store.getState().setManagedMaterial('main',assign);expect(store.getState().draft).toBe(draft);
  store.getState().undo();expect(store.getState().managedMaterials).toBeUndefined();store.getState().redo();expect(store.getState().managedMaterials?.main?.material.materialId).toBe(fixture.materialId);
  const id=await store.getState().saveDesign();store.getState().newDesign();expect(store.getState().managedMaterials).toBeUndefined();expect(await store.getState().loadDesign(id)).toBe(true);expect(store.getState().managedMaterials?.main).toEqual(assign);
  store.getState().setManagedMaterial('main',null);expect(store.getState().managedMaterials?.main).toBeUndefined();store.getState().undo();expect(store.getState().managedMaterials?.main).toEqual(assign);
  for(const bad of [{...fixture,status:1},{...fixture,status:null},{...fixture,materialType:'F'}]){expect(canAssignMaterial(bad)).toBe(false);expect(()=>store.getState().setManagedMaterial('neck',{...assign,material:bad})).toThrow();}
  expect(()=>readManagedAssignments({main:{...assign,token:'not-allowed'}})).toThrow();
});
