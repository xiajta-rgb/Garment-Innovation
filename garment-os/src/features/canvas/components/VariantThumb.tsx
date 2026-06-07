import type { PartType, PartVariant } from '@/data/garmentParts';
import { splitPaths } from './GarmentSketch.utils';

/** 部件类型 → 缩略图 viewBox 映射 */
const VIEWBOX_MAP: Record<PartType, string> = {
  body: '-20 -5 240 290',
  collar: '40 10 120 80',
  sleeve: '-20 30 240 200',
  pocket: '50 80 100 110',
  placket: '70 30 60 210',
  cuff: '-20 185 240 40',
};

interface VariantThumbProps {
  variant: PartVariant;
  partType: PartType;
}

/** 部件变体缩略图 (用于部件选择面板) */
export function VariantThumb({ variant, partType }: VariantThumbProps) {
  const pathData = variant.frontPath;
  if (!pathData) {
    return (
      <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>None</span>
      </div>
    );
  }

  return (
    <svg viewBox={VIEWBOX_MAP[partType]} style={{ width: 52, height: 52 }}>
      {splitPaths(pathData).map((subPath, i) => (
        <path
          key={i}
          d={subPath}
          fill={variant.filled ? 'var(--bg-hover)' : 'none'}
          stroke="var(--text-muted)"
          strokeWidth={partType === 'body' ? '0.8' : '1'}
          strokeDasharray={variant.strokeDash}
        />
      ))}
      {/* 缩略图也渲染细节线 */}
      {variant.details && splitPaths(variant.details).map((subPath, i) => (
        <path
          key={`d-${i}`}
          d={subPath}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="0.4"
          opacity="0.5"
        />
      ))}
    </svg>
  );
}
