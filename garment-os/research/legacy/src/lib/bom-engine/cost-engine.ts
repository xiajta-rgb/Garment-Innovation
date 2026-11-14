/**
 * V2 实时数字孪生 BOM 与成本引擎
 * 基于 V2 开发文档 §3.3
 *
 * 核心升级:
 * 1. 格林公式精确面积计算 (替代 V1 bounding box 近似)
 * 2. 支持 CMT 工费 / 关税 / 汇率 / 多币种
 * 3. 基于基因实例的实时成本更新
 */

import type { GeneInstance, CostParameters, CostBreakdown, CostBomItem } from '@/types/gene';
import type { Material } from '@/types/material';
import { calculatePathArea } from '@/lib/parametric/utils';

// ─── 面料数据 (V2 本地模拟, 后续对接供应链 API) ───

export const MATERIAL_DATABASE: Map<string, Material> = new Map([
  ['FAB-001', {
    id: 'FAB-001',
    assetCode: 'FAB-001',
    name: '全棉府绸',
    category: '梭织',
    imageUrl: '',
    widthMm: 1450,
    weightGsm: 120,
    pricePerMeter: 18.5,
    lossRate: 0.12,
    color: '#FFFFFF',
    composition: '100% Cotton',
  }],
  ['FAB-002', {
    id: 'FAB-002',
    assetCode: 'FAB-002',
    name: '涤棉斜纹',
    category: '梭织',
    imageUrl: '',
    widthMm: 1500,
    weightGsm: 180,
    pricePerMeter: 22.0,
    lossRate: 0.10,
    color: '#2F4F4F',
    composition: '65% Polyester 35% Cotton',
  }],
  ['FAB-003', {
    id: 'FAB-003',
    assetCode: 'FAB-003',
    name: '真丝缎面',
    category: '梭织',
    imageUrl: '',
    widthMm: 1140,
    weightGsm: 80,
    pricePerMeter: 68.0,
    lossRate: 0.15,
    color: '#FAEBD7',
    composition: '100% Silk',
  }],
  ['BTN-001', {
    id: 'BTN-001',
    assetCode: 'BTN-001',
    name: '树脂四眼扣',
    category: '辅料',
    imageUrl: '',
    widthMm: 0,
    weightGsm: 0,
    pricePerMeter: 0.15, // 单价(元/粒), 复用字段
    lossRate: 0.02,
    composition: 'Resin',
  }],
]);

// ─── 成本引擎 ───

export class CostEngine {
  private static instance: CostEngine;

  private constructor() {}

  static getInstance(): CostEngine {
    if (!CostEngine.instance) {
      CostEngine.instance = new CostEngine();
    }
    return CostEngine.instance;
  }

  /**
   * 计算单件成衣 FOB 成本
   * 基于 V2 开发文档 §3.3.2
   */
  calculateFOBCost(
    geneInstances: GeneInstance[],
    costParams: CostParameters
  ): CostBreakdown {
    const bomItems: CostBomItem[] = [];
    let materialCost = 0;

    // 坐标系比例: viewBox 200x280 对应实际尺寸
    // 假设 1 单位 = 5mm (即 200 单位 = 1000mm = 1m 的半身宽)
    const SCALE_MM_PER_UNIT = 5;

    for (const instance of geneInstances) {
      for (const path of instance.paths) {
        if (!path.data) continue;

        // 精确面积计算 (格林公式)
        const areaUnits2 = calculatePathArea(path.data);
        const areaMm2 = areaUnits2 * SCALE_MM_PER_UNIT * SCALE_MM_PER_UNIT;
        const areaM2 = areaMm2 / 1_000_000;

        // 查找面料
        const materialId = path.materialId || 'FAB-001';
        const material = MATERIAL_DATABASE.get(materialId);
        if (!material) continue;

        // 面料用量计算
        if (material.category === '辅料') {
          // 辅料按件计价
          const qty = this.estimateAccessoryQty(instance);
          const itemCost = qty * material.pricePerMeter;
          materialCost += itemCost;
          bomItems.push({
            id: `bom-${instance.id}-${path.id}-acc`,
            componentName: `${instance.name} - ${material.name}`,
            materialAssetCode: material.assetCode,
            usage: qty,
            unit: '粒',
            unitPrice: material.pricePerMeter,
            cost: Math.round(itemCost * 100) / 100,
          });
        } else {
          // 面料按米计价
          const fabricWidthM = material.widthMm / 1000;
          const theoreticalUsage = fabricWidthM > 0 ? areaM2 / fabricWidthM : 0;
          const actualUsage = theoreticalUsage * (1 + material.lossRate);
          const itemCost = actualUsage * material.pricePerMeter;
          materialCost += itemCost;

          bomItems.push({
            id: `bom-${instance.id}-${path.id}`,
            componentName: `${instance.name} - ${material.name}`,
            materialAssetCode: material.assetCode,
            usage: Math.round(actualUsage * 1000) / 1000,
            unit: 'm',
            unitPrice: material.pricePerMeter,
            cost: Math.round(itemCost * 100) / 100,
          });
        }
      }
    }

    // 总成本计算
    const laborCost = costParams.laborCost;
    const subtotal = materialCost + laborCost;
    const tariffCost = subtotal * costParams.tariffRate;
    const totalCost = (subtotal + tariffCost) * costParams.exchangeRate;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      materialCost: Math.round(materialCost * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      tariffCost: Math.round(tariffCost * 100) / 100,
      currencyCode: costParams.currencyCode,
      bomItems,
    };
  }

  /** 估算辅料用量 */
  private estimateAccessoryQty(instance: GeneInstance): number {
    const p = instance.parameterValues;
    switch (instance.category) {
      case 'placket':
        return typeof p.buttonCount === 'number' ? p.buttonCount : 5;
      case 'cuff':
        return 2; // 左右袖口各1粒
      default:
        return 1;
    }
  }
}

// ─── 默认成本参数 ───

export const DEFAULT_COST_PARAMS: CostParameters = {
  laborCost: 25,       // CMT 工费 25元
  tariffRate: 0.13,    // 13% 增值税
  exchangeRate: 1,     // 人民币基准
  currencyCode: 'CNY',
};
