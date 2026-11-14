// 工作空间
export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isSynced: boolean;
  lastSyncVersion: number;
}

// 款式/设计稿
export interface Garment {
  id: string;
  workspaceId: string;
  styleCode: string;      // 款式号
  category: string;       // 品类
  name: string;           // 款式名称
  canvasData: string;     // Konva.js 序列化 JSON
  thumbnail?: string;     // 缩略图
  createdAt: number;
  updatedAt: number;
  isDirty: boolean;       // 是否有未同步的修改
  version: number;
}

// 同步状态
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
