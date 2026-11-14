/**
 * 设计持久化数据库 (IndexedDB)
 * 存储设计文档、版型资产、面料资产
 */

import type { DesignDocument, FabricAsset, PatternAsset } from '@/types/gene';

const DB_NAME = 'garment-innovation';
const DB_VERSION = 2;

const STORE_DESIGNS = 'designs';
const STORE_FABRICS = 'fabrics';
const STORE_PATTERNS = 'patterns';

class DesignDB {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    // 互斥锁: 多次调用共享同一个 open promise
    if (this.dbReady) return this.dbReady;

    this.dbReady = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.dbReady = null; // 失败时重置，允许重试
        reject(request.error);
      };
      request.onsuccess = () => {
        this.db = request.result;
        // 监听意外关闭，重置状态
        this.db.onclose = () => {
          this.db = null;
          this.dbReady = null;
        };
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // V1: 初始创建所有表
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE_DESIGNS)) {
            const store = db.createObjectStore(STORE_DESIGNS, { keyPath: 'id' });
            store.createIndex('gender', 'gender', { unique: false });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
            store.createIndex('name', 'name', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORE_FABRICS)) {
            const store = db.createObjectStore(STORE_FABRICS, { keyPath: 'id' });
            store.createIndex('fabricType', 'fabricType', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORE_PATTERNS)) {
            const store = db.createObjectStore(STORE_PATTERNS, { keyPath: 'id' });
            store.createIndex('gender', 'gender', { unique: false });
          }
        }

        // V2: 为 designs 表新增 tags 多值索引
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(STORE_DESIGNS)) return;
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const store = tx.objectStore(STORE_DESIGNS);
          if (!store.indexNames.contains('tags')) {
            store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          }
        }

        // 后续版本迁移在此追加:
        // if (oldVersion < 3) { ... }
      };
    });
    return this.dbReady; // 修复: 之前忘记 return，async 函数隐式返回 undefined
  }

  // ─── 设计文档 CRUD ───

  async saveDesign(doc: DesignDocument): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DESIGNS, 'readwrite');
      const store = tx.objectStore(STORE_DESIGNS);
      const request = store.put(doc);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDesign(id: string): Promise<DesignDocument | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DESIGNS, 'readonly');
      const store = tx.objectStore(STORE_DESIGNS);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllDesigns(): Promise<DesignDocument[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DESIGNS, 'readonly');
      const store = tx.objectStore(STORE_DESIGNS);
      const index = store.index('updatedAt');
      const request = index.openCursor(null, 'prev');
      const results: DesignDocument[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDesign(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DESIGNS, 'readwrite');
      const store = tx.objectStore(STORE_DESIGNS);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ─── 面料资产 CRUD ───

  async saveFabric(fabric: FabricAsset): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FABRICS, 'readwrite');
      const store = tx.objectStore(STORE_FABRICS);
      const request = store.put(fabric);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFabrics(): Promise<FabricAsset[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FABRICS, 'readonly');
      const store = tx.objectStore(STORE_FABRICS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFabric(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FABRICS, 'readwrite');
      const store = tx.objectStore(STORE_FABRICS);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ─── 版型资产 CRUD ───

  async savePattern(pattern: PatternAsset): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PATTERNS, 'readwrite');
      const store = tx.objectStore(STORE_PATTERNS);
      const request = store.put(pattern);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPatterns(): Promise<PatternAsset[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PATTERNS, 'readonly');
      const store = tx.objectStore(STORE_PATTERNS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePattern(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PATTERNS, 'readwrite');
      const store = tx.objectStore(STORE_PATTERNS);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new DesignDB();
