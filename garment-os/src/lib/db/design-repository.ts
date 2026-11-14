import { DESIGN_SCHEMA, type DesignDocument, type DesignRepository, type DesignSummary } from '@/types/design';

/** Keep the existing DB and stores. No bulk migration, deletion or startup I/O. */
export function createIndexedDbDesignRepository(factory = () => globalThis.indexedDB): DesignRepository {
  let connection: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    let abandoned = false;
    const pending = Promise.resolve().then(() => new Promise<IDBDatabase>((resolve, reject) => {
      // Probe the current version first. This keeps the legacy repository
      // compatible with callers that still open version 2 while allowing the
      // asset repository to upgrade the same database to version 3.
      const probe = factory().open('garment-innovation');
      probe.onerror = () => reject(probe.error);
      probe.onsuccess = () => {
        const currentVersion = probe.result.version;
        probe.result.close();
        const request = factory().open('garment-innovation', Math.max(2, currentVersion));
      request.onupgradeneeded = () => {
        const db = request.result;
        const designs = db.objectStoreNames.contains('designs') ? request.transaction!.objectStore('designs') : db.createObjectStore('designs', { keyPath: 'id' });
        for (const name of ['gender','updatedAt','name']) if (!designs.indexNames.contains(name)) designs.createIndex(name,name);
        if (!designs.indexNames.contains('tags')) designs.createIndex('tags','tags',{ multiEntry: true });
        // Retain compatibility stores, including any existing user assets.
        if (!db.objectStoreNames.contains('fabrics')) db.createObjectStore('fabrics',{keyPath:'id'}).createIndex('fabricType','fabricType');
        if (!db.objectStoreNames.contains('patterns')) db.createObjectStore('patterns',{keyPath:'id'}).createIndex('gender','gender');
        if (!db.objectStoreNames.contains('designAssets')) {
          const assets = db.createObjectStore('designAssets', { keyPath: 'id' });
          for (const name of ['status','categoryId','patternId','createdAt','updatedAt','matrixBatchId','reviewStatus','sourceDesignId','sourcePlanId']) assets.createIndex(name, name);
          assets.createIndex('tags', 'tags', { multiEntry: true });
        } else {
          const assets = request.transaction!.objectStore('designAssets');
          for (const name of ['status','categoryId','patternId','createdAt','updatedAt','matrixBatchId','reviewStatus','sourceDesignId','sourcePlanId']) if (!assets.indexNames.contains(name)) assets.createIndex(name, name);
          if (!assets.indexNames.contains('tags')) assets.createIndex('tags', 'tags', { multiEntry: true });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) { db.close(); return; }
        db.onversionchange = () => { db.close(); if (connection === pending) connection = null; };
        db.onclose = () => { if (connection === pending) connection = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { abandoned = true; reject(new Error('设计存储被其他页面占用，请关闭旧版本页面后重试')); };
      };
    })).catch(error => {
      if (connection === pending) connection = null;
      throw error;
    });
    connection = pending;
    return pending;
  }
  async function transaction<T>(mode: IDBTransactionMode, execute: (store: IDBObjectStore, setResult: (value: T) => void) => void): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('designs',mode);
      let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error ?? new Error('设计存储事务失败'));
      tx.onabort = () => reject(tx.error ?? new Error('设计存储事务已撤销'));
      try { execute(tx.objectStore('designs'), result => { value = result; }); }
      catch (error) { tx.abort(); reject(error); }
    });
  }
  return {
    save: doc => transaction<void>('readwrite',store => { store.put(structuredClone(doc)); }),
    get: id => transaction<unknown>('readonly',(store,result) => { const request = store.get(id); request.onsuccess = () => result(request.result); }),
    delete: id => transaction<void>('readwrite',store => { store.delete(id); }),
    list: () => transaction<DesignSummary[]>('readonly',(store,result) => {
      const rows: DesignSummary[] = [], request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { result(rows.sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0) || a.id.localeCompare(b.id))); return; }
        const doc = cursor.value as Partial<DesignDocument>;
        if (typeof doc.id === 'string') rows.push({ id: doc.id, name: typeof doc.name === 'string' ? doc.name : '未命名历史设计',
          gender: ['male','female','unisex'].includes(String(doc.gender)) ? doc.gender! : null,
          updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : '', format: doc.schema === DESIGN_SCHEMA ? 'current' : 'legacy' });
        cursor.continue();
      };
    }),
  };
}
export const designRepository = createIndexedDbDesignRepository();
