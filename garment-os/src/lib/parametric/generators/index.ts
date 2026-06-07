import type { GeneInstance, GenePathData, GeneAnchors } from '@/types/gene';
import { generateBody } from './body';
import { generateCollar } from './collar';
import { generateSleeve } from './sleeve';
import { generatePocket } from './pocket';
import { generatePlacket } from './placket';
import { generateCuff } from './cuff';

export { generateBody } from './body';
export { generateCollar } from './collar';
export { generateSleeve } from './sleeve';
export { generatePocket } from './pocket';
export { generatePlacket } from './placket';
export { generateCuff } from './cuff';

/**
 * 部件上下文: 包含父部件的参数 + 解析后的锚点
 * 这是整合接口: 所有子部件都通过 ctx 访问父部件
 */
export interface PartCtx {
  parameters: Record<string, number | string | boolean>;
  anchors: GeneAnchors;
}

/**
 * 几何生成调度器
 * 根据实例 category 路由到对应的部件生成器
 * 自动注入依赖部件的 ctx (parameters + resolvedAnchors)
 *
 * 关键整合点:
 * - body 接收 collarCtx (领口形状整合进大身轮廓)
 * - sleeve 接收 bodyCtx (袖山镜像袖窿, 锚点共享)
 * - pocket/placket 接收 bodyCtx (位置联动)
 * - cuff 接收 bodyCtx + sleeveCtx (位置/宽度联动)
 */
export function generateGeometry(instance: GeneInstance, allInstances: GeneInstance[]): GenePathData[] {
  const p = instance.parameterValues;
  const category = instance.category;

  // 构建依赖部件的 ctx (供整合使用)
  const bodyInst = allInstances.find((i) => i.category === 'body');
  const bodyCtx: PartCtx = {
    parameters: bodyInst?.parameterValues ?? {},
    anchors: bodyInst?.resolvedAnchors ?? {},
  };

  const sleeveInst = allInstances.find((i) => i.category === 'sleeve');
  const sleeveCtx: PartCtx = {
    parameters: sleeveInst?.parameterValues ?? {},
    anchors: sleeveInst?.resolvedAnchors ?? {},
  };

  const collarInst = allInstances.find((i) => i.category === 'collar');
  const collarCtx: PartCtx = {
    parameters: collarInst?.parameterValues ?? {},
    anchors: collarInst?.resolvedAnchors ?? {},
  };

  switch (category) {
    case 'body':
      return generateBody(p, collarCtx);
    case 'collar':
      return generateCollar(p, bodyCtx);
    case 'sleeve':
      return generateSleeve(p, bodyCtx);
    case 'pocket':
      return generatePocket(p, bodyCtx);
    case 'placket':
      return generatePlacket(p, bodyCtx);
    case 'cuff':
      return generateCuff(p, sleeveCtx, bodyCtx);
    default:
      return [];
  }
}
