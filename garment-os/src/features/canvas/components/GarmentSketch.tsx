import { useParametricStore } from '@/store/parametricStore';
import type { GenePathData } from '@/types/gene';
import type { PartType } from '@/data/garmentParts';
import { catDataHasFill, splitPaths } from './GarmentSketch.utils';
import { measurementsToAllParams } from '@/lib/parametric/measurement-formulas';

interface GarmentSketchProps {
  view: 'front' | 'back';
  garmentColor: string;
}

// 工业级 11 种 layer 全部支持 (Milestone B)
// Clean View 只渲染: cutting-line, seam-line, stitch, detail (真正的"线稿")
// Industrial View 渲染全部 11 种 (布纹线/折叠线/剪口/省道/钻孔 等工业符号)
const LAYER_ORDER = [
  'cutting-line', 'seam-line', 'grain-line', 'fold-line',
  'notch', 'dart', 'drill-hole', 'stitch', 'detail', 'outline', 'annotation',
] as const;
type LayerType = typeof LAYER_ORDER[number];
/** Clean 模式下显示的 layer (即 "线稿" 视图) */
const CLEAN_LAYERS: Set<LayerType> = new Set(['cutting-line', 'seam-line', 'stitch', 'detail', 'outline', 'annotation']);

// 渲染顺序: 衣身在下 (底色), 袖子在衣身之上 (袖山覆盖肩部), 领/袋/门襟/袖口叠加最上层
// 这样形成"一体式"层次而非"平铺"层次
const RENDER_ORDER: PartType[] = ['body', 'sleeve', 'collar', 'pocket', 'placket', 'cuff'];

/**
 * 成衣线稿渲染组件
 * - 中心前/后线、水平参考线 (胸围/腰围/臀围)
 * - 分层渲染 (outline → stitch → detail)
 * - 尺寸标注
 * - 视图标签 (FRONT/BACK VIEW)
 */
export function GarmentSketch({ view, garmentColor }: GarmentSketchProps) {
  const instances = useParametricStore((s) => s.instances);
  const patternPaths = useParametricStore((s) => s.patternPaths);
  const viewMode = useParametricStore((s) => s.viewMode);
  const fillColor = garmentColor === '#FFFFFF' ? 'var(--bg-hover)' : garmentColor;
  // Block+Pattern 模式: 优先使用 patternPaths (来自 composePattern)
  const usePatternMode = patternPaths.length > 0;

  // 收集所有路径并按层级分组 (从 LAYER_ORDER 动态初始化, 避免遗漏新 layer 类型)
  const layeredPaths = Object.fromEntries(
    LAYER_ORDER.map((k) => [k, [] as { cat: string; pathData: GenePathData; subPath: string; key: string }[]])
  ) as Record<LayerType, { cat: string; pathData: GenePathData; subPath: string; key: string }[]>;

  // 路径数据源: Block+Pattern 模式用 patternPaths (来自 composePattern),
  // 修复 #14: 统一 sourcePaths 累加器 (消除 if-else 重复)
  //  - Pattern 模式: 优先用 patternPaths (来自 composePattern, 实时)
  //  - 旧模式 (fallback): 走 instances[cat].paths
  //  - 视觉过滤: view 匹配 + RENDER_ORDER 包含
  const sourcePaths: Array<{ cat: string; pathData: GenePathData }> = [];
  const collectFromPathData = (pathData: GenePathData) => {
    if (!pathData.data) return;
    const cat = pathData.category ?? pathData.id.split('-')[0];
    if (!RENDER_ORDER.includes(cat as PartType)) return;
    const pathView = (pathData as any).view;
    if (pathView && pathView !== 'all' && pathView !== view) return;
    sourcePaths.push({ cat, pathData });
  };

  if (usePatternMode) {
    for (const pathData of patternPaths) collectFromPathData(pathData);
  } else {
    for (const cat of RENDER_ORDER) {
      const inst = instances[cat];
      if (!inst?.paths) continue;
      for (const pathData of inst.paths) collectFromPathData(pathData);
    }
  }

  for (let i = 0; i < sourcePaths.length; i++) {
    const { cat, pathData } = sourcePaths[i];
    // 兜底: 任何未识别的 layer 都归到 outline, 防止 undefined.push
    const layer: LayerType = (pathData.layer && (pathData.layer as LayerType) in layeredPaths
      ? (pathData.layer as LayerType)
      : 'outline');

    for (let j = 0; j < splitPaths(pathData.data).length; j++) {
      layeredPaths[layer].push({
        cat,
        pathData,
        subPath: splitPaths(pathData.data)[j],
        key: `${cat}-${i}-${j}`,
      });
    }
  }

  return (
    <svg viewBox="-20 -5 240 290" style={{ width: '85%', height: 'auto' }}>
      {/* 中心前/后线 - 只在 industrial 模式下显示 (因为 industrial 模式下 fold-line 会替代此线) */}
      {viewMode === 'industrial' && (
        <>
          {/* 水平参考线: 胸围/腰围/臀围 - industrial 模式专属辅助线 */}
          <g stroke="var(--text-muted)" strokeWidth="0.3" strokeDasharray="2,4" opacity="0.15">
            <line x1="20" y1="96" x2="180" y2="96" />
            <line x1="20" y1="140" x2="180" y2="140" />
            <line x1="20" y1="172" x2="180" y2="172" />
          </g>
        </>
      )}

      {/* 分层渲染: 根据 viewMode 过滤 layer */}
      {LAYER_ORDER.map((layer) => {
        // Clean 模式: 跳过 grain-line/fold-line/notch/dart/drill-hole (工业符号)
        if (viewMode === 'clean' && !CLEAN_LAYERS.has(layer)) return null;
        const paths = layeredPaths[layer];
        if (paths.length === 0) return null;
        return (
          <g key={layer}>
            {paths.map(({ cat, pathData, subPath, key }) => {
              const isFilled = pathData.fill !== 'none' && (cat === 'body' || cat === 'sleeve' || catDataHasFill(cat, pathData));
              return (
                <path
                  key={key}
                  d={subPath}
                  fill={isFilled ? fillColor : (pathData.fill !== 'none' ? fillColor : 'none')}
                  stroke={pathData.stroke || '#000000'}
                  strokeWidth={pathData.strokeWidth || 0.8}
                  strokeDasharray={pathData.strokeDasharray}
                  strokeLinecap={pathData.strokeLinecap}
                  // 修复 Issue 1+2+3: 应用 transform 属性 (mirror/rotate/translate)
                  transform={pathData.transform}
                />
              );
            })}
          </g>
        );
      })}

      {/* 对位剪口标记 (修复 #13: 动态坐标 - 跟随 body 几何变化)
          - 6 个剪口点: 肩点 (sp)、袖窿底 (ap)、腰线 (side-waist)
          - 左侧/右侧镜像
          - 坐标从 body 锚点读取, 切换 size/fit 时自动跟随
          - 仅 industrial 模式显示 */}
      {viewMode === 'industrial' && (() => {
        // 动态计算剪口坐标 - 从 patternPaths 中查找 sp-left/sp-right 等锚点 (后兼容)
        // 实际坐标用 body 几何关键点估算 (工业级: 跟随 size 变化)
        const sp = useParametricStore.getState().measurements;
        const sw = Number(sp?.shoulderWidth ?? 32);
        const ad = Number(sp?.armholeDepth ?? 96);
        // BodyMeasurements 只有围度+长度, 腰线 y 坐标从 derived.body.waistY 推
        const gender = useParametricStore.getState().gender;
        const fit = useParametricStore.getState().fit;
        const fallbackMeasurements = {
          neckCirc: 360, bust: 880, waist: 720, hip: 920,
          bicep: 280, wristCirc: 160, shoulderWidth: 32,
          acrossBack: 360, acrossFront: 340,
          backLength: 420, frontLength: 400, armholeDepth: 200, sleeveLength: 560,
          waistDepth: 380, hipDepth: 200, totalLength: 700,
          height: 1700, weight: 70000,
        };
        const derived = measurementsToAllParams(sp ?? fallbackMeasurements, gender, fit);
        const wy = Number(derived.body?.waistY ?? 140);
        const cx = 100;
        const xLeft = cx - sw;
        const xRight = cx + sw;
        const notches: [number, number][] = [
          [xLeft - 2, 48 - 2], [xRight + 2, 48 - 2],   // 肩点
          [xLeft + 4, ad - 2],  [xRight - 4, ad - 2],   // 袖窿底
          [xLeft + 2, wy - 2],  [xRight - 2, wy - 2],   // 腰线
        ];
        return (
          <g stroke="var(--text-muted)" strokeWidth="0.4" fill="none" opacity="0.4">
            {notches.map(([x, y], i) => (
              <path key={i} d={`M${x - 1},${y + 2} L${x},${y} L${x + 1},${y + 2}`} />
            ))}
          </g>
        );
      })()}

      {/* 尺寸标注线 - 修复 #5: 从 store 读 active measurements (与 patternPaths 数据源一致) */}
      <DimensionAnnotations view={view} />

      {/* 视图标签 */}
      <text x="100" y="268" textAnchor="middle" fontSize="7" fill="var(--text-muted)" letterSpacing="1.5" opacity="0.6">
        {view === 'front' ? 'FRONT VIEW' : 'BACK VIEW'}
      </text>
    </svg>
  );
}

/**
 * 尺寸标注: 从 store 读 active measurements + 推导参数
 * 修复 #5: 数据源与 patternPaths 一致 (都来自 measurementsToAllParams)
 */
function DimensionAnnotations({ view }: { view: 'front' | 'back' }) {
  const measurements = useParametricStore((s) => s.measurements);
  const gender = useParametricStore((s) => s.gender);
  const fit = useParametricStore((s) => s.fit);
  if (!measurements) return null;

  // 修复 #5: 直接从 store 推导 (与 composePattern 数据源一致)
  const derived = measurementsToAllParams(measurements, gender, fit);
  const bodyParams = derived.body ?? {};
  const sleeveParams = derived.sleeve ?? {};

  const shoulderW = Number(bodyParams.shoulderWidth ?? 32);
  const shoulderY = Number(bodyParams.shoulderY ?? 48);
  const armholeDepth = Number(bodyParams.armholeDepth ?? 96);
  const hemY = Number(bodyParams.hemLength ?? 224);
  const hemW = Number(bodyParams.hemWidth ?? 42);
  const neckFrontY = Number(bodyParams.neckFrontY ?? 34);
  const sleeveLength = Number(sleeveParams.sleeveLength ?? 160);

  const cx = 100;
  const annColor = 'var(--text-muted)';
  const annOpacity = 0.5;

  // 标注项: [x1, y1, x2, y2, label, offset]
  const dims: [number, number, number, number, string, number][] = [];

  if (view === 'front') {
    dims.push([cx, shoulderY, cx + shoulderW, shoulderY, `${shoulderW * 2}cm`, 12]);
    dims.push([cx - shoulderW - 8, neckFrontY, cx - shoulderW - 8, hemY, `${((hemY - neckFrontY) * 0.5).toFixed(0)}cm`, -14]);
    dims.push([cx + shoulderW + 8, shoulderY, cx + shoulderW + 8, armholeDepth, `${((armholeDepth - shoulderY) * 0.5).toFixed(0)}cm`, 14]);
    dims.push([cx, hemY, cx + hemW, hemY, `${hemW * 2}cm`, 10]);
    if (sleeveParams && String(sleeveParams.sleeveType) !== 'sleeveless') {
      dims.push([cx + shoulderW + 16, shoulderY, cx + shoulderW + 16, shoulderY + sleeveLength, `${(sleeveLength * 0.5).toFixed(0)}cm`, 22]);
    }
  }

  return (
    <g stroke={annColor} fill={annColor} fontSize="5" opacity={annOpacity}>
      {dims.map(([x1, y1, x2, y2, label, offset], i) => {
        const isHorizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
        if (isHorizontal) {
          const midX = (x1 + x2) / 2;
          return (
            <g key={i}>
              <line x1={x1} y1={y1 + offset} x2={x2} y2={y2 + offset} strokeWidth="0.3" />
              <line x1={x1} y1={y1 + offset - 2} x2={x1} y2={y1 + offset + 2} strokeWidth="0.3" />
              <line x1={x2} y1={y2 + offset - 2} x2={x2} y2={y2 + offset + 2} strokeWidth="0.3" />
              <text x={midX} y={y1 + offset - 2} textAnchor="middle" fontSize="4.5">{label}</text>
            </g>
          );
        } else {
          const midY = (y1 + y2) / 2;
          return (
            <g key={i}>
              <line x1={x1 + offset} y1={y1} x2={x2 + offset} y2={y2} strokeWidth="0.3" />
              <line x1={x1 + offset - 2} y1={y1} x2={x1 + offset + 2} y2={y1} strokeWidth="0.3" />
              <line x1={x2 + offset - 2} y1={y2} x2={x2 + offset + 2} y2={y2} strokeWidth="0.3" />
              <text x={x1 + offset + (offset > 0 ? 4 : -4)} y={midY + 1.5} textAnchor={offset > 0 ? 'start' : 'end'} fontSize="4.5">{label}</text>
            </g>
          );
        }
      })}
    </g>
  );
}
