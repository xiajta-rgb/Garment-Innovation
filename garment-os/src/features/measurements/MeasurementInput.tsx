/**
 * 测量值输入面板
 *
 * 商业化基础 (Milestone A) 的核心 UI:
 * - 标准尺码选择 (S/M/L/XL)
 * - 当前版型 (slim/regular/loose)
 * - 17 项核心测量值可视化展示 (可微调)
 * - 一键应用: 切换尺码/调整测量 → 自动推导所有部件参数
 *
 * 设计原则: 不让用户看到"魔数", 只让用户看到"我的身体数据"
 */

import { useState } from 'react';
import { useParametricStore } from '@/store/parametricStore';
import type { StandardSize, BodyMeasurements } from '@/types/measurements';
import {
  FormatPainterOutlined,
  EditOutlined,
  FieldTimeOutlined,
  ColumnHeightOutlined,
  SkinOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons';

const SIZE_OPTIONS: StandardSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const FIT_OPTIONS = [
  { value: 'slim' as const, label: '紧身', ease: '0-2cm' },
  { value: 'regular' as const, label: '合身', ease: '4-6cm' },
  { value: 'loose' as const, label: '宽松', ease: '10-14cm' },
];

/** 测量值字段元信息 (单位 + 显示名 + 简写) */
const MEASUREMENT_FIELDS: Array<{
  key: keyof BodyMeasurements;
  label: string;
  short: string;
  unit: string;
  min: number;
  max: number;
}> = [
  { key: 'bust',         label: '胸围',     short: 'B',  unit: 'mm', min: 700,  max: 1300 },
  { key: 'waist',        label: '腰围',     short: 'W',  unit: 'mm', min: 600,  max: 1200 },
  { key: 'hip',          label: '臀围',     short: 'H',  unit: 'mm', min: 800,  max: 1400 },
  { key: 'shoulderWidth', label: '总肩宽',  short: 'SW', unit: 'mm', min: 340,  max: 520 },
  { key: 'sleeveLength', label: '袖长',     short: 'SL', unit: 'mm', min: 450,  max: 700 },
  { key: 'totalLength',  label: '衣长',     short: 'TL', unit: 'mm', min: 500,  max: 900 },
];

/** 简略字段显示 (cm) */
const fmt = (mm: number) => `${(mm / 10).toFixed(1)}cm`;

export function MeasurementInput() {
  const measurements = useParametricStore((s) => s.measurements);
  const standardSize = useParametricStore((s) => s.standardSize);
  const fit = useParametricStore((s) => s.fit);
  const viewMode = useParametricStore((s) => s.viewMode);
  const setSize = useParametricStore((s) => s.setSize);
  const updateMeasurements = useParametricStore((s) => s.updateMeasurements);
  const setFit = useParametricStore((s) => s.setFit);
  const setViewMode = useParametricStore((s) => s.setViewMode);
  const gender = useParametricStore((s) => s.gender);

  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '6px 8px',
        fontSize: 10,
        color: 'var(--text-primary)',
      }}
    >
      {/* ─── 视图模式 (Clean 线稿 / Industrial 工业纸样) ─── */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 9,
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          <FormatPainterOutlined /> 视图模式
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => setViewMode('clean')}
            style={{
              flex: 1,
              padding: '4px 0',
              background: viewMode === 'clean' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: viewMode === 'clean' ? '#fff' : 'var(--text-primary)',
              border: '1px solid ' + (viewMode === 'clean' ? 'var(--accent)' : 'var(--border)'),
              borderRadius: 3,
              fontSize: 9,
              fontWeight: viewMode === 'clean' ? 600 : 400,
              cursor: 'pointer',
            }}
            title="纯线稿: 净样线 + 明线 + 细节线"
          >
            <EditOutlined /> 线稿
          </button>
          <button
            onClick={() => setViewMode('industrial')}
            style={{
              flex: 1,
              padding: '4px 0',
              background: viewMode === 'industrial' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: viewMode === 'industrial' ? '#fff' : 'var(--text-primary)',
              border: '1px solid ' + (viewMode === 'industrial' ? 'var(--accent)' : 'var(--border)'),
              borderRadius: 3,
              fontSize: 9,
              fontWeight: viewMode === 'industrial' ? 600 : 400,
              cursor: 'pointer',
            }}
            title="工业纸样: 含布纹线/折叠线/剪口/省道/钻孔"
          >
            <FieldTimeOutlined /> 工业
          </button>
        </div>
      </div>

      {/* ─── 尺码选择 ─── */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 9, color: 'var(--text-muted)' }}>
            <ColumnHeightOutlined /> 尺码 · {gender === 'female' ? '女' : '男'}
          </span>
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
            ASTM D5586/D5585
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              onClick={() => setSize(size)}
              style={{
                flex: 1,
                padding: '4px 0',
                background: standardSize === size ? 'var(--accent)' : 'var(--bg-secondary)',
                color: standardSize === size ? '#fff' : 'var(--text-primary)',
                border: '1px solid ' + (standardSize === size ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 3,
                fontSize: 9,
                fontWeight: standardSize === size ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 版型选择 ─── */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 9,
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          <SkinOutlined /> 版型 (放松量)
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {FIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFit(opt.value)}
              title={`放松量: ${opt.ease}`}
              style={{
                flex: 1,
                padding: '3px 0',
                background: fit === opt.value ? 'var(--accent)' : 'var(--bg-secondary)',
                color: fit === opt.value ? '#fff' : 'var(--text-primary)',
                border: '1px solid ' + (fit === opt.value ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 3,
                fontSize: 9,
                fontWeight: fit === opt.value ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 测量值简表 (可展开详细) ─── */}
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 8,
            textAlign: 'left',
            cursor: 'pointer',
            padding: 0,
            marginBottom: 4,
          }}
        >
          {expanded ? <DownOutlined /> : <RightOutlined />} 测量值 ({expanded ? '点击折叠' : '点击展开微调'})
        </button>

        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {MEASUREMENT_FIELDS.map((f) => (
              <MeasurementRow
                key={f.key}
                label={f.label}
                short={f.short}
                value={measurements[f.key]}
                min={f.min}
                max={f.max}
                onChange={(v) => updateMeasurements({ [f.key]: v } as Partial<BodyMeasurements>)}
              />
            ))}
          </div>
        )}

        {!expanded && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
              fontSize: 9,
              color: 'var(--text-secondary)',
            }}
          >
            {MEASUREMENT_FIELDS.slice(0, 6).map((f) => (
              <div
                key={f.key}
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '3px 4px',
                  borderRadius: 2,
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: 7 }}>{f.short} </span>
                <span style={{ fontWeight: 600 }}>{fmt(measurements[f.key])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  short: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function MeasurementRow({ label, short: _short, value, min, max, onChange }: RowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ flex: '0 0 50px', fontSize: 9, color: 'var(--text-muted)' }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, height: 4 }}
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 50,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: 9,
          padding: '2px 4px',
          borderRadius: 2,
        }}
      />
      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>mm</span>
    </div>
  );
}
