/**
 * V2 参数化基因引擎 — 类型定义
 * 基于 V2 开发文档 §3.1
 */

// ─── 基因参数 ───

export interface GeneParameter {
  id: string;
  name: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  unit?: string;
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number | string | boolean; label: string }[];
  /** 参数依赖关系 */
  dependsOn?: {
    parameterId: string;
    condition: string;
  };
}

// ─── 锚点 ───

export interface AnchorPoint {
  id: string;
  name: string;
  /** 锚点坐标 (相对于基因自身坐标系) */
  x: number;
  y: number;
  /** 可连接的基因类型 */
  allowedConnections: string[];
}

// ─── 工艺约束规则 ───

export interface ConstraintRule {
  id: string;
  description: string;
  /** 约束表达式, 返回布尔值 */
  expression: string;
  /** 违反约束时的提示信息 */
  errorMessage: string;
  /** warning 仅提示, error 强制阻断 */
  level: 'warning' | 'error';
}

// ─── 基因定义 (模板) ───

export interface Gene {
  id: string;
  name: string;
  category: 'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff';
  subCategory: string;
  version: string;
  description: string;

  /** 可调整参数定义 */
  parameters: GeneParameter[];

  /** 几何生成函数 (序列化存储为字符串) */
  geometryGenerator: string;

  /** 拓扑锚点定义 (用于组件间拼接) */
  anchors: AnchorPoint[];

  /** 工艺约束规则 */
  constraints: ConstraintRule[];

  /** 默认 BOM 项 */
  defaultBomItems: DefaultBomItem[];

  /** 预览缩略图 */
  thumbnail?: string;
}

export interface DefaultBomItem {
  materialAssetCode: string;
  usagePerPiece: number;
  unit: string;
}

// ─── 基因实例 (运行时) ───

/** 锚点类型别名 (与 GeneInstance.resolvedAnchors 同构) */
export type GeneAnchors = Record<string, { x: number; y: number; meta?: Record<string, number> }>;

export interface GeneInstance {
  id: string;
  geneId: string;
  name: string;
  category: Gene['category'];
  /** 当前参数值 */
  parameterValues: Record<string, number | string | boolean>;
  /** 解算后的几何路径 */
  paths: GenePathData[];
  /** 解算后的锚点坐标 (含可选 meta 用于标量信息如曲线长度) */
  resolvedAnchors: Record<string, { x: number; y: number; meta?: Record<string, number> }>;
  /** 约束违规列表 */
  violations: RuleViolation[];
}

export interface GenePathData {
  id: string;
  data: string;       // SVG path d 属性
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** SVG stroke-dasharray, 如 "1,2" 表示明线(topstitching) */
  strokeDasharray?: string;
  /** SVG stroke-linecap */
  strokeLinecap?: 'butt' | 'round' | 'square';
  /**
   * 修复 Issue 1+2+3: SVG transform 属性 (替代脆弱的 d 字符串正则变换)
   * 由 composePattern 的 applyTransform 设置, 渲染器 <path transform=...>
   * 支持所有 SVG transform 操作 (translate/rotate/scale/matrix), 无路径命令兼容问题
   */
  transform?: string;
  /**
   * 修复 Issue 9: 显式类别元数据 (替代字符串 split 检测)
   * 表明此路径属于哪个部件: body/sleeve/collar/cuff/pocket/placket
   */
  category?: string;
  /**
   * 工业级纸样符号层级:
   * - cutting-line: 净样线 (粗实线 0.8mm, 裁剪用)
   * - seam-line:    缝份线 (细实线 0.4mm, 缝合参考)
   * - grain-line:   布纹线 (双向箭头, 标识 fabric 方向)
   * - fold-line:    折叠线 (虚线 + 折叠符号, 对称纸样用)
   * - notch:        剪口 (三角形标记, 拼合对位)
   * - dart:         省道 (虚线 + 三角/菱形, 收省位)
   * - drill-hole:   钻孔 (小圆点, 定位孔)
   * - stitch:       明线 (虚线 1,2, 0.3mm, 装饰缝合)
   * - detail:       细节线 (细实线 0.4mm, 结构线)
   * - outline:      通用轮廓 (向后兼容)
   * - annotation:   标注 (尺寸/文字)
   */
  layer?: 'cutting-line' | 'seam-line' | 'grain-line' | 'fold-line' | 'notch' | 'dart' | 'drill-hole' | 'stitch' | 'detail' | 'outline' | 'annotation';
  materialId?: string;
}

// ─── 规则违规 ───

export interface RuleViolation {
  ruleId: string;
  message: string;
  level: 'warning' | 'error';
}

// ─── 成本计算参数 ───

export interface CostParameters {
  laborCost: number;       // CMT 工费 (元)
  tariffRate: number;      // 关税率
  exchangeRate: number;    // 汇率
  currencyCode: string;    // 货币代码
}

export interface CostBreakdown {
  totalCost: number;
  materialCost: number;
  laborCost: number;
  tariffCost: number;
  currencyCode: string;
  bomItems: CostBomItem[];
}

export interface CostBomItem {
  id: string;
  componentName: string;
  materialAssetCode: string;
  usage: number;       // 米
  unit: string;
  unitPrice: number;   // 元/米
  cost: number;        // 元
}

// ─── 性别类型 ───

export type GenderType = 'male' | 'female' | 'unisex';

// ─── 设计持久化 ───

export interface DesignDocument {
  id: string;
  name: string;
  gender: GenderType;
  /** 设计创建时间 (ISO string) */
  createdAt: string;
  /** 最后修改时间 */
  updatedAt: string;
  /** 缩略图 (base64 data URL) */
  thumbnail?: string;
  /** 各部件参数快照 */
  instances: Record<string, GeneInstance>;
  /** 面料/颜色 */
  garmentColor: string;
  fabricId: string;
  /** 成本参数 */
  costParams: CostParameters;
  /** 标签 */
  tags: string[];
  /** 修复 #10: Block+Pattern 架构状态 (避免加载后丢失) */
  activePatternId?: string;
  viewMode?: 'clean' | 'industrial';
  view?: 'front' | 'back';
}

export interface FabricAsset {
  id: string;
  name: string;
  /** 缩略图 (CSS background) */
  pattern: string;
  /** 面料编码 */
  assetCode: string;
  /** 面料类型 */
  fabricType: string;
  /** 克重 (g/m2) */
  weight?: number;
  /** 幅宽 (mm) */
  widthMm?: number;
  /** 单价 (元/米) */
  pricePerMeter?: number;
  /** 适用性别 */
  gender: GenderType[];
}

export interface PatternAsset {
  id: string;
  name: string;
  /** 基因参数快照 */
  parameterValues: Record<string, Record<string, number | string | boolean>>;
  gender: GenderType;
  createdAt: string;
}
