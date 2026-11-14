// 面料定义
export interface Material {
  id: string;
  assetCode: string;       // 物料编码
  name: string;
  category: string;        // 面料类别
  imageUrl: string;        // 面料图片 URL
  widthMm: number;         // 幅宽(mm)
  weightGsm: number;       // 克重(gsm)
  pricePerMeter: number;   // 单价(元/米)
  lossRate: number;        // 损耗率，默认 0.12
  color?: string;          // 主色调
  composition?: string;    // 成分
}

// 面料适配器接口
export interface MaterialAdapter {
  fetchMaterials(): Promise<Material[]>;
  searchMaterials(query: string): Promise<Material[]>;
}
