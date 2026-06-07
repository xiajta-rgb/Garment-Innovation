// 画布组件路径数据
export interface PathData {
  data: string;       // SVG path d 属性
  fill: string;       // 填充色或纹理 URL
  stroke: string;     // 描边色
  strokeWidth: number;
}

// 画布上的组件实例
export interface CanvasComponent {
  id: string;
  templateId?: string;
  name: string;
  category?: ComponentCategory;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  paths: PathData[];
  materialId?: string; // 已应用的面料 ID
  locked?: boolean;
  visible?: boolean;
  zIndex?: number;
}

export type ComponentCategory = 'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff' | 'tops' | 'trousers' | 'dresses' | 'skirts' | 'jumpsuits' | 'suit';

// 画布状态
export interface CanvasState {
  stageWidth: number;
  stageHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  components: CanvasComponent[];
  selectedId: string | null;
  snapEnabled: boolean;
}
