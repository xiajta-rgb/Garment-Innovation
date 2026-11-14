import { expect,it,vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createIndexedDbDesignRepository } from '@/lib/db/design-repository';
import { createDesignStore } from '@/store/designStore';
import { DESIGN_SCHEMA, type DesignDocument } from '@/types/design';
function document(): DesignDocument {
  const repository=createIndexedDbDesignRepository(()=>new IDBFactory());
  const s=createDesignStore({repository}).getState(),date=new Date().toISOString();
  return {schema:DESIGN_SCHEMA,id:'design-a',name:'test',gender:s.gender,tags:[],createdAt:date,updatedAt:date,configuration:s.getConfiguration(),presentation:{view:'front',viewMode:'clean'}};
}
it('committed save/get/list/delete roundtrip preserves exact source inputs',async()=>{
  const factory=new IDBFactory(),repository=createIndexedDbDesignRepository(()=>factory),doc=document();
  await repository.save(doc);expect(await repository.get(doc.id)).toEqual(doc);
  expect(await repository.list()).toEqual([{id:doc.id,name:doc.name,gender:'male',updatedAt:doc.updatedAt,format:'current'}]);
  await repository.delete(doc.id);expect(await repository.get(doc.id)).toBeUndefined();
});
it('request success followed by transaction abort rejects and leaves no saved row',async()=>{
  const factory=new IDBFactory(),repository=createIndexedDbDesignRepository(()=>factory),put=IDBObjectStore.prototype.put;
  const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<typeof put>){
    const request=put.apply(this,args);request.addEventListener('success',()=>this.transaction.abort());return request;
  });
  try { await expect(repository.save(document())).rejects.toThrow(/撤销/); }
  finally { spy.mockRestore(); }
  expect(await repository.get('design-a')).toBeUndefined();
});
it('failed opening can retry instead of caching a rejected connection forever',async()=>{
  const factory=new IDBFactory();let fail=true;
  const repository=createIndexedDbDesignRepository(()=>{if(fail){fail=false;throw Error('unavailable');}return factory;});
  await expect(repository.list()).rejects.toThrow('unavailable');expect(await repository.list()).toEqual([]);
});
it('upgrade preserves legacy assets and treats unknown gender as unknown',async()=>{
  const factory=new IDBFactory();
  const old=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=factory.open('garment-innovation',1);request.onerror=()=>reject(request.error);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('designs',{keyPath:'id'});db.createObjectStore('fabrics',{keyPath:'id'});db.createObjectStore('patterns',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);
  });
  await new Promise<void>(resolve=>{const tx=old.transaction(['designs','fabrics'],'readwrite');tx.objectStore('designs').put({id:'old',updatedAt:'2026-01-01'});tx.objectStore('designs').put({id:'missing-time'});tx.objectStore('fabrics').put({id:'my-fabric',custom:true});tx.oncomplete=()=>resolve();});
  const repository=createIndexedDbDesignRepository(()=>factory);
  await expect(repository.list()).rejects.toThrow(/占用/);old.close();
  const rows=await repository.list();
  expect(rows[0]).toMatchObject({id:'old',gender:null,format:'legacy'});expect(rows[1]).toMatchObject({id:'missing-time',updatedAt:'',gender:null});
  const upgraded=await new Promise<IDBDatabase>(resolve=>{const r=factory.open('garment-innovation',2);r.onsuccess=()=>resolve(r.result);});
  const fabric=await new Promise<unknown>(resolve=>{const r=upgraded.transaction('fabrics').objectStore('fabrics').get('my-fabric');r.onsuccess=()=>resolve(r.result);});
  expect(fabric).toEqual({id:'my-fabric',custom:true});upgraded.close();
});
