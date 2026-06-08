import { useRef, useEffect, useState, useMemo } from 'react';
import { useParametricStore } from '@/store/parametricStore';
import type { GenePathData } from '@/types/gene';
import type { PartType } from '@/data/garmentParts';
import { catDataHasFill, splitPaths } from './GarmentSketch.utils';
import { getFabricSvgPattern } from '@/data/fabrics';

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
  const activePart = useParametricStore((s) => s.activePart);
  const fillColor = garmentColor === '#FFFFFF' ? 'var(--bg-hover)' : garmentColor;
  // Block+Pattern 模式: 优先使用 patternPaths (来自 composePattern)
  const usePatternMode = patternPaths.length > 0;

  // 面料纹理: 从 store 读取 fabricId, 生成 SVG pattern defs
  const fabricId = useParametricStore((s) => s.fabricId);
  const fabricSvgPattern = useMemo(() => getFabricSvgPattern(fabricId), [fabricId]);
  const hasFabricPattern = fabricId !== 'solid' && fabricSvgPattern;

  // 动态 viewBox: 根据实际渲染内容自动适配
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const [viewBox, setViewBox] = useState('-20 -5 240 290');

  useEffect(() => {
    if (!contentRef.current) return;
    try {
      const bbox = contentRef.current.getBBox();
      if (bbox.width === 0 || bbox.height === 0) return;
      const pad = 15;
      setViewBox(`${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    } catch {
      // getBBox 可能在元素未渲染时失败，保持默认 viewBox
    }
  }, [patternPaths, instances, viewMode, view, garmentColor]);

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
    <svg id="garment-sketch" ref={svgRef} viewBox={viewBox} style={{ width: '85%', height: 'auto' }}>
      {/* 面料纹理 SVG pattern 定义 */}
      <defs>
        {hasFabricPattern && (
          <g dangerouslySetInnerHTML={{ __html: fabricSvgPattern }} />
        )}
      </defs>
      <g ref={contentRef}>
      {/* 中心前/后线 - 只在 industrial 模式下显示 (因为 industrial 模式下 fold-line 会替代此线) */}
      {viewMode === 'industrial' && (() => {
        // 从 patternAnchors 读取实际坐标, 使参考线跟随服装几何变化
        const anchors = useParametricStore.getState().patternAnchors;
        const spL = anchors['sp-left'];
        const spR = anchors['sp-right'];
        const apL = anchors['ap-left'];
        const swL = anchors['side-waist-left'];
        const hipL = anchors['hip-left'];
        if (!spL || !spR) return null;
        // 参考线 Y 坐标: 袖窿底(胸围)、腰线、臀围
        const bustY = apL ? apL.y : 96;
        const waistY = swL ? swL.y : 140;
        const hipY = hipL ? hipL.y : 172;
        const leftX = Math.min(spL.x, spR.x) - 20;
        const rightX = Math.max(spL.x, spR.x) + 20;
        return (
          <g stroke="var(--text-muted)" strokeWidth="0.3" strokeDasharray="2,4" opacity="0.15">
            <line x1={leftX} y1={bustY} x2={rightX} y2={bustY} />
            <line x1={leftX} y1={waistY} x2={rightX} y2={waistY} />
            <line x1={leftX} y1={hipY} x2={rightX} y2={hipY} />
          </g>
        );
      })()}

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
              const isActivePart = cat === activePart;
              // 面料纹理: 有纹理时用纯色底 + 纹理叠加, 否则用纯色
              const pathFill = isFilled
                ? fillColor
                : (pathData.fill !== 'none' ? fillColor : 'none');
              return (
                <g key={key}>
                  {/* 底色层 */}
                  <path
                    d={subPath}
                    fill={pathFill}
                    stroke={pathData.stroke || '#000000'}
                    strokeWidth={isActivePart ? (pathData.strokeWidth || 0.8) + 0.4 : (pathData.strokeWidth || 0.8)}
                    strokeDasharray={pathData.strokeDasharray}
                    strokeLinecap={pathData.strokeLinecap}
                    transform={pathData.transform}
                    style={isActivePart
                      ? { filter: 'drop-shadow(0 0 2px var(--accent))', transition: 'filter 0.2s', color: garmentColor }
                      : { transition: 'filter 0.2s', color: garmentColor }
                    }
                  />
                  {/* 面料纹理叠加层 */}
                  {isFilled && hasFabricPattern && (
                    <path
                      d={subPath}
                      fill={`url(#fabric-${fabricId})`}
                      stroke="none"
                      transform={pathData.transform}
                      opacity={0.6}
                      style={{ color: garmentColor }}
                    />
                  )}
                </g>
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
        // 从 patternAnchors 读取实际渲染坐标 (与 composePattern 数据源一致)
        const anchors = useParametricStore.getState().patternAnchors;
        const spL = anchors['sp-left'];
        const spR = anchors['sp-right'];
        const apL = anchors['ap-left'];
        const apR = anchors['ap-right'];
        const swL = anchors['side-waist-left'];
        const swR = anchors['side-waist-right'];
        if (!spL || !spR) return null;
        const notches: [number, number][] = [
          [spL.x, spL.y], [spR.x, spR.y],       // 肩点
        ];
        if (apL) notches.push([apL.x, apL.y]);
        if (apR) notches.push([apR.x, apR.y]);
        if (swL) notches.push([swL.x, swL.y]);
        if (swR) notches.push([swR.x, swR.y]);
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

      {/* 视图标签 - 动态跟随服装底部 */}
      {(() => {
        const anchors = useParametricStore.getState().patternAnchors;
        const cfHem = anchors['cf-hem'];
        const labelY = cfHem ? cfHem.y + 30 : 268;
        const cx = anchors['sp-left'] ? (anchors['sp-left'].x + anchors['sp-right'].x) / 2 : 100;
        return (
          <text x={cx} y={labelY} textAnchor="middle" fontSize="7" fill="var(--text-muted)" letterSpacing="1.5" opacity="0.6">
            {view === 'front' ? 'FRONT VIEW' : 'BACK VIEW'}
          </text>
        );
      })()}
      </g>
    </svg>
  );
}

/**
 * 尺寸标注: 从 patternAnchors 读取实际渲染坐标
 * 数据源与 composePattern 一致, 避免与路径坐标不匹配
 */
function DimensionAnnotations({ view }: { view: 'front' | 'back' }) {
  const anchors = useParametricStore((s) => s.patternAnchors);

  // 从锚点读取坐标
  const spL = anchors['sp-left'];
  const spR = anchors['sp-right'];
  const apL = anchors['ap-left'];
  const cfNeck = anchors['cf-neck'];
  const cfHem = anchors['cf-hem'];
  const shL = anchors['side-hem-left'];
  const shR = anchors['side-hem-right'];

  if (!spL || !spR || !cfNeck || !cfHem) return null;

  const shoulderW = (spR.x - spL.x) / 2;
  const shoulderY = spL.y;
  const neckFrontY = cfNeck.y;
  const hemY = cfHem.y;
  const hemW = shR ? shR.x - 100 : shoulderW;
  const armholeDepth = apL ? apL.y : shoulderY + 48;

  const cx = 100;
  const annColor = 'var(--text-muted)';
  const annOpacity = 0.5;

  const dims: [number, number, number, number, string, number][] = [];

  if (view === 'front') {
    dims.push([cx, shoulderY, cx + shoulderW, shoulderY, `${(shoulderW * 2).toFixed(0)}`, 12]);
    dims.push([cx - shoulderW - 8, neckFrontY, cx - shoulderW - 8, hemY, `${((hemY - neckFrontY) * 0.5).toFixed(0)}`, -14]);
    dims.push([cx + shoulderW + 8, shoulderY, cx + shoulderW + 8, armholeDepth, `${((armholeDepth - shoulderY) * 0.5).toFixed(0)}`, 14]);
    if (shL && shR) {
      dims.push([cx, hemY, cx + hemW, hemY, `${(hemW * 2).toFixed(0)}`, 10]);
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
