/** Portable pattern input format. No browser, persistence or editor dependency. */
import type { PatternDefinition } from '@/lib/patterns/types';
import type { BodyMeasurements, StandardSize } from '@/types/measurements';
import type { GenderType } from '@/types/measurements';
import type { ConstructionSelection } from '@/types/construction';

export const PATTERN_SCHEMA_VERSION = 'garment-os/pattern/v1';

export interface PatternExportEnvelope {
  schema: string;
  version: number;
  exportedAt: string;
  exportedBy?: string;
  pattern: PatternDefinition;
  /** 可选: 用户定制 (测量值, 性别, 版型) - 接收方可选择性应用 */
  overrides?: {
    measurements?: Partial<BodyMeasurements>;
    gender?: GenderType;
    fit?: 'slim' | 'regular' | 'loose';
    standardSize?: StandardSize;
    engineVersion?: string;
    construction?: ConstructionSelection;
  };
}

/** 序列化 Pattern 为 JSON 字符串 */
export function serializePattern(
  pattern: PatternDefinition,
  overrides?: PatternExportEnvelope['overrides'],
  exportedBy?: string
): string {
  const envelope: PatternExportEnvelope = {
    schema: PATTERN_SCHEMA_VERSION,
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy,
    pattern,
    overrides,
  };
  return JSON.stringify(envelope, null, 2);
}

/** 解析 JSON 字符串为 Pattern */
export function deserializePattern(json: string): PatternExportEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`, { cause:err });
  }

  // 验证 schema
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Pattern file must be a JSON object');
  }
  const parsed=value as Record<string,unknown>;
  if (parsed.schema !== PATTERN_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported pattern schema "${parsed.schema}", expected "${PATTERN_SCHEMA_VERSION}"`
    );
  }

  // 验证 pattern 必填字段
  const p = parsed.pattern as Record<string,unknown> | undefined;
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') {
    throw new Error('Pattern must have id and name');
  }
  if (!Array.isArray(p.blocks)) {
    throw new Error('Pattern.blocks must be an array');
  }
  for (const ref of p.blocks) {
    if (!ref || typeof ref !== 'object' || typeof ref.blockId !== 'string') {
      throw new Error('Each PatternBlockRef must have a blockId');
    }
  }

  return parsed as unknown as PatternExportEnvelope;
}

/** 文件名生成: {pattern.id}-{size}-{date}.json */
export function generateFilename(pattern: PatternDefinition, size?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const sizePart = size ? `-${size}` : '';
  return `${pattern.id}${sizePart}-${date}.json`;
}
