/**
 * ─────────────────────────────────────────────────────────────
 *  BOM 主料用量引擎 (Fabric Usage Estimator)
 * ─────────────────────────────────────────────────────────────
 *
 *  从真实 mm 版型毛样面积 → 排料 → 主料米数。
 *  这是"专业 BOM"与拍脑袋估料的分水岭:
 *    用量 = Σ(毛样面积) / (门幅 × 排料利用率) + 损耗
 */

export interface FabricUsageInput {
  /** 各裁片毛样面积 (mm²), 已含缝份 */
  pieceAreasMm2: number[];
  /** 裁片件数 (与 pieceAreasMm2 一一对应) */
  pieceQty?: number[];
  /** 面料门幅 (mm) */
  fabricWidthMm: number;
  /** 排料利用率 (0-1, 梭织平纹 0.80-0.88, 默认 0.85) */
  efficiency?: number;
  /** 面料损耗率 (0-1, 疵点/端头, 默认 0.03) */
  lossRate?: number;
}

export interface FabricUsageResult {
  /** 净排料长度 (mm) */
  layoutLengthMm: number;
  /** 含损耗的实际采购长度 (mm) */
  purchaseLengthMm: number;
  /** 米数 (向上取整到 0.05m) */
  lengthM: number;
  /** 单件总面积 (mm²) */
  totalPieceAreaMm2: number;
  /** 有效利用面积 = 门幅×长度×效率 */
  usableAreaMm2: number;
}

/**
 * 排料用料估算
 * 原理: 排料长度 L 内可用面积 = L × 门幅 × 效率 ≥ Σ毛样面积
 */
export function estimateFabricUsage(input: FabricUsageInput): FabricUsageResult {
  const {
    pieceAreasMm2,
    pieceQty,
    fabricWidthMm,
    efficiency = 0.85,
    lossRate = 0.03,
  } = input;

  let totalArea = 0;
  for (let i = 0; i < pieceAreasMm2.length; i++) {
    const qty = pieceQty?.[i] ?? 1;
    totalArea += pieceAreasMm2[i] * qty;
  }

  const layoutLengthMm = totalArea / (fabricWidthMm * Math.min(0.95, Math.max(0.5, efficiency)));
  const purchaseLengthMm = layoutLengthMm * (1 + lossRate);
  // 米数向上取整到 5cm (采购习惯)
  const lengthM = Math.ceil((purchaseLengthMm / 1000) * 20) / 20;

  return {
    layoutLengthMm,
    purchaseLengthMm,
    lengthM,
    totalPieceAreaMm2: totalArea,
    usableAreaMm2: layoutLengthMm * fabricWidthMm * Math.min(0.95, Math.max(0.5, efficiency)),
  };
}


