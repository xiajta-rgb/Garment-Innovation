import type { SqliteMessage, SqliteResponse } from './types';

let db: any = null;

async function initDatabase(): Promise<void> {
  if (db) return;

  try {
    // @ts-ignore - SQLite WASM 模块没有类型声明
    const sqlite3Module = await import('@sqlite.org/sqlite-wasm');
    const sqlite3 = await sqlite3Module.default();

    if (sqlite3.opfs) {
      db = new sqlite3.oo1.OpfsDb('garment-os-v1.db', 'cw');
    } else {
      db = new sqlite3.oo1.DB(':memory:');
    }

    db.exec([
      'PRAGMA journal_mode=WAL;',
      'PRAGMA synchronous=NORMAL;',
      'PRAGMA temp_store=MEMORY;',
      'PRAGMA cache_size=-64000;',
    ].join('\n'));

    db.exec(`
      CREATE TABLE IF NOT EXISTS edge_workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_synced INTEGER DEFAULT 0,
        last_sync_version INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS edge_garments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        style_code TEXT NOT NULL,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        canvas_data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_dirty INTEGER DEFAULT 1,
        version INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS edge_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        thumbnail TEXT NOT NULL,
        canvas_data TEXT NOT NULL,
        default_bom_items TEXT NOT NULL,
        version INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS edge_materials (
        id TEXT PRIMARY KEY,
        asset_code TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        image_url TEXT NOT NULL,
        width_mm INTEGER NOT NULL,
        weight_gsm INTEGER NOT NULL,
        price_per_meter REAL NOT NULL,
        loss_rate REAL NOT NULL DEFAULT 0.12
      );
      CREATE TABLE IF NOT EXISTS edge_boms (
        id TEXT PRIMARY KEY,
        garment_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        component_name TEXT NOT NULL,
        usage REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT 'm',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_garments_workspace ON edge_garments(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_templates_category ON edge_templates(category);
      CREATE INDEX IF NOT EXISTS idx_boms_garment ON edge_boms(garment_id);
    `);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

function query(sql: string, params?: any[]): any[] {
  if (!db) throw new Error('Database not initialized');
  const results: any[] = [];
  db.exec({ sql, bind: params, rowMode: 'object', callback: (row: any) => results.push(row) });
  return results;
}

function run(sql: string, params?: any[]): void {
  if (!db) throw new Error('Database not initialized');
  db.exec({ sql, bind: params });
}

self.onmessage = async (e: MessageEvent<SqliteMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'INIT':
        await initDatabase();
        postMessage({ type: 'INIT_SUCCESS', id: msg.id } satisfies SqliteResponse);
        break;
      case 'QUERY':
        const results = query(msg.sql, msg.params);
        postMessage({ type: 'QUERY_RESULT', id: msg.id, results } satisfies SqliteResponse);
        break;
      case 'RUN':
        run(msg.sql, msg.params);
        postMessage({ type: 'RUN_RESULT', id: msg.id } satisfies SqliteResponse);
        break;
    }
  } catch (error: any) {
    postMessage({ type: 'ERROR', id: msg.id, error: error.message } satisfies SqliteResponse);
  }
};
