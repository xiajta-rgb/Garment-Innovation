// Worker 通信类型定义

export type SqliteMessage =
  | { type: 'INIT'; id: string }
  | { type: 'QUERY'; id: string; sql: string; params?: any[] }
  | { type: 'RUN'; id: string; sql: string; params?: any[] };

export type SqliteResponse =
  | { type: 'INIT_SUCCESS'; id: string }
  | { type: 'INIT_ERROR'; id: string; error: string }
  | { type: 'QUERY_RESULT'; id: string; results: any[] }
  | { type: 'RUN_RESULT'; id: string }
  | { type: 'ERROR'; id: string; error: string };
