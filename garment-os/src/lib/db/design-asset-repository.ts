import type {
  DesignAssetListQuery,
  DesignAssetPage,
  DesignAssetRecord,
  DesignAssetRepository,
  DesignAssetSummary,
} from '@/types/design-library';

const DB_NAME = 'garment-innovation';
const DB_VERSION = 3;

function summary(asset: DesignAssetRecord): DesignAssetSummary {
  return {
    id: asset.id,
    name: asset.name,
    categoryId: asset.categoryId,
    patternId: asset.patternId,
    tags: [...asset.tags],
    matrixBatchId: asset.matrixBatchId,
    reviewStatus: asset.reviewStatus,
    status: asset.status,
    sourceDesignId: asset.sourceDesignId,
    sourcePlanId: asset.sourcePlanId,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    deletedAt: asset.deletedAt,
    version: asset.version,
  };
}

export function createIndexedDbDesignAssetRepository(factory = () => globalThis.indexedDB): DesignAssetRepository {
  let connection: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    const pending = Promise.resolve().then(() => new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory().open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('designs')) {
          const designs = db.createObjectStore('designs', { keyPath: 'id' });
          designs.createIndex('gender', 'gender');
          designs.createIndex('updatedAt', 'updatedAt');
          designs.createIndex('name', 'name');
          designs.createIndex('tags', 'tags', { multiEntry: true });
        }
        if (!db.objectStoreNames.contains('fabrics')) db.createObjectStore('fabrics', { keyPath: 'id' }).createIndex('fabricType', 'fabricType');
        if (!db.objectStoreNames.contains('patterns')) db.createObjectStore('patterns', { keyPath: 'id' }).createIndex('gender', 'gender');
        if (!db.objectStoreNames.contains('designAssets')) {
          const assets = db.createObjectStore('designAssets', { keyPath: 'id' });
          for (const name of ['status', 'categoryId', 'patternId', 'createdAt', 'updatedAt', 'matrixBatchId', 'reviewStatus', 'sourceDesignId', 'sourcePlanId']) assets.createIndex(name, name);
          assets.createIndex('tags', 'tags', { multiEntry: true });
        } else {
          const assets = request.transaction!.objectStore('designAssets');
          for (const name of ['status', 'categoryId', 'patternId', 'createdAt', 'updatedAt', 'matrixBatchId', 'reviewStatus', 'sourceDesignId', 'sourcePlanId']) if (!assets.indexNames.contains(name)) assets.createIndex(name, name);
          if (!assets.indexNames.contains('tags')) assets.createIndex('tags', 'tags', { multiEntry: true });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        db.onclose = () => { connection = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('设计资产存储被其他页面占用，请关闭旧版本页面后重试'));
    })).catch(error => { connection = null; throw error; });
    connection = pending;
    return pending;
  }
  function transaction<T>(mode: IDBTransactionMode, execute: (store: IDBObjectStore, setResult: (value: T) => void) => void): Promise<T> {
    return open().then(db => new Promise<T>((resolve, reject) => {
      const tx = db.transaction('designAssets', mode);
      let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error ?? new Error('设计资产事务失败'));
      tx.onabort = () => reject(tx.error ?? new Error('设计资产事务已撤销'));
      try { execute(tx.objectStore('designAssets'), result => { value = result; }); }
      catch (error) { tx.abort(); reject(error); }
    }));
  }
  return {
    save: asset => transaction<void>('readwrite', (store, done) => {
      if (asset.schema !== 'garment-os/design-asset/v1') throw new Error('设计资产格式无效');
      const request = store.get(asset.id);
      request.onsuccess = () => {
        const previous = request.result as DesignAssetRecord | undefined;
        const next: DesignAssetRecord = {
          ...structuredClone(asset),
          productionApproved: false,
          createdAt: previous?.createdAt ?? asset.createdAt,
          version: Math.max(1, (previous?.version ?? 0) + (previous ? 1 : 0)),
          status: previous?.status === 'trash' ? previous.status : asset.status,
          deletedAt: previous?.deletedAt,
        };
        store.put(next);
        done(undefined);
      };
    }),
    get: id => transaction<DesignAssetRecord | undefined>('readonly', (store, done) => {
      const request = store.get(id);
      request.onsuccess = () => done(request.result ? structuredClone(request.result as DesignAssetRecord) : undefined);
    }),
    list: (query: DesignAssetListQuery = {}) => transaction<DesignAssetPage>('readonly', (store, done) => {
      const status = query.status ?? 'active';
      const text = query.query?.trim().toLowerCase() ?? '';
      const offset = Math.max(0, query.offset ?? 0);
      const limit = Math.min(100, Math.max(1, query.limit ?? 24));
      const matched: DesignAssetSummary[] = [];
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          const sorted = matched.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) || a.id.localeCompare(b.id));
          const items = sorted.slice(offset, offset + limit);
          done({ items, total: sorted.length, offset, limit, hasMore: offset + limit < sorted.length });
          return;
        }
        const asset = cursor.value as DesignAssetRecord;
        const searchable = `${asset.name} ${asset.id} ${asset.categoryId} ${asset.patternId} ${asset.matrixBatchId ?? ''} ${asset.tags.join(' ')}`.toLowerCase();
        if (asset.status === status && (!query.categoryId || asset.categoryId === query.categoryId) && (!query.patternId || asset.patternId === query.patternId) && (!query.matrixBatchId || asset.matrixBatchId === query.matrixBatchId) && (!query.reviewStatus || asset.reviewStatus === query.reviewStatus) && (!text || searchable.includes(text))) matched.push(summary(asset));
        cursor.continue();
      };
    }),
    moveToTrash: (id, deletedAt = new Date().toISOString()) => transaction<void>('readwrite', (store, done) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const asset = request.result as DesignAssetRecord | undefined;
        if (!asset) throw new Error('未找到设计资产');
        store.put({ ...asset, status: 'trash', deletedAt, updatedAt: deletedAt, version: asset.version + 1 });
        done(undefined);
      };
    }),
    restore: id => transaction<void>('readwrite', (store, done) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const asset = request.result as DesignAssetRecord | undefined;
        if (!asset) throw new Error('未找到垃圾桶资产');
        const updatedAt = new Date().toISOString();
        store.put({ ...asset, status: 'active', deletedAt: undefined, updatedAt, version: asset.version + 1 });
        done(undefined);
      };
    }),
    purge: id => transaction<void>('readwrite', (store, done) => { store.delete(id); done(undefined); }),
  };
}

export const designAssetRepository = createIndexedDbDesignAssetRepository();
