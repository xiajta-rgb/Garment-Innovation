import type { Material } from './material';

// BOM 项
export interface BomItem {
  id: string;
  garmentId: string;
  componentId: string;      // 对应画布组件 ID
  componentName: string;    // 使用部位
  material: Material;       // 面料信息
  usage: number;            // 单件用量(米)
  unit: string;             // 单位
  cost: number;             // 金额(元)
}

// BOM 汇总
export interface BomSummary {
  items: BomItem[];
  totalCost: number;
  totalUsage: number;
}
