import type { SqliteMessage, SqliteResponse } from './types';

type PendingRequest = {
  resolve: (value: SqliteResponse) => void;
  reject: (reason: any) => void;
};

let worker: Worker | null = null;
const pendingRequests = new Map<string, PendingRequest>();
let requestId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<SqliteResponse>) => {
      const msg = e.data;
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        pendingRequests.delete(msg.id);
        if (msg.type === 'ERROR') {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg);
        }
      }
    };
    worker.onerror = (e) => {
      console.error('[SQLite Worker] Error:', e);
    };
  }
  return worker;
}

function sendRequest(msg: SqliteMessage): Promise<SqliteResponse> {
  return new Promise((resolve, reject) => {
    pendingRequests.set(msg.id, { resolve, reject });
    getWorker().postMessage(msg);

    setTimeout(() => {
      if (pendingRequests.has(msg.id)) {
        pendingRequests.delete(msg.id);
        reject(new Error('Request timeout'));
      }
    }, 10000);
  });
}

export async function initDatabase(): Promise<void> {
  const id = `req-${++requestId}`;
  const result = await sendRequest({ type: 'INIT', id });
  if (result.type === 'INIT_ERROR') {
    throw new Error(result.error);
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const id = `req-${++requestId}`;
  const result = await sendRequest({ type: 'QUERY', id, sql, params });
  if (result.type === 'QUERY_RESULT') {
    return result.results as T[];
  }
  throw new Error('Query failed');
}

export async function run(sql: string, params?: any[]): Promise<void> {
  const id = `req-${++requestId}`;
  await sendRequest({ type: 'RUN', id, sql, params });
}

export async function insert(table: string, data: Record<string, any>): Promise<void> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  await run(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
}

export async function findById<T = any>(table: string, id: string): Promise<T | null> {
  const results = await query<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return results[0] ?? null;
}

export async function removeById(table: string, id: string): Promise<void> {
  await run(`DELETE FROM ${table} WHERE id = ?`, [id]);
}
