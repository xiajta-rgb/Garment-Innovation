/**
 * Pattern IO (导入/导出)
 *
 * 商业化关键功能 - 让模板可分发:
 *  - 设计师可以保存/分享自己的 Pattern
 *  - 接收方导入即用
 *  - 模板可形成社区市场
 *
 * JSON 格式 (schema 'garment-os/pattern/v1'):
 *  {
 *    schema: "garment-os/pattern/v1",
 *    exportedAt: "2024-...",
 *    exportedBy: "designer-name",
 *    pattern: PatternDefinition,
 *    overrides?: { measurements, fit, gender }   // 用户定制
 *  }
 */

import type { PatternDefinition } from '@/lib/patterns/types';
import type { BodyMeasurements } from '@/types/measurements';
import type { GenderType } from '@/types/gene';

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
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 验证 schema
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Pattern file must be a JSON object');
  }
  if (parsed.schema !== PATTERN_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported pattern schema "${parsed.schema}", expected "${PATTERN_SCHEMA_VERSION}"`
    );
  }

  // 验证 pattern 必填字段
  const p = parsed.pattern;
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') {
    throw new Error('Pattern must have id and name');
  }
  if (!Array.isArray(p.blocks)) {
    throw new Error('Pattern.blocks must be an array');
  }
  for (const ref of p.blocks) {
    if (typeof ref.blockId !== 'string') {
      throw new Error('Each PatternBlockRef must have a blockId');
    }
  }

  return parsed as PatternExportEnvelope;
}

/** 触发浏览器下载 JSON 文件 */
export function downloadPatternJSON(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 触发文件选择器, 读入 JSON */
export function selectPatternFile(): Promise<PatternExportEnvelope> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      try {
        const text = await file.text();
        resolve(deserializePattern(text));
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

/** 文件名生成: {pattern.id}-{size}-{date}.json */
export function generateFilename(pattern: PatternDefinition, size?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const sizePart = size ? `-${size}` : '';
  return `${pattern.id}${sizePart}-${date}.json`;
}
