import { useParametricStore } from '@/store/parametricStore';
import { GENE_DEFINITIONS, getPresetsByGender } from '@/data/geneLibrary';
import type { GeneParameter } from '@/types/gene';

/**
 * 参数化滑块面板
 * - 预设快捷切换
 * - 数字参数滑块
 * - Select 类型参数按钮组
 * - 约束违规提示
 */
export function ParamSliders() {
  const activePart = useParametricStore((s) => s.activePart);
  const instances = useParametricStore((s) => s.instances);
  const updateParameter = useParametricStore((s) => s.updateParameter);
  const applyPreset = useParametricStore((s) => s.applyPreset);
  const gender = useParametricStore((s) => s.gender);

  const instance = instances[activePart];
  const gene = GENE_DEFINITIONS.find((g) => g.category === activePart);
  const presets = getPresetsByGender(activePart, gender);

  if (!gene) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 预设快捷切换 */}
      {presets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {presets.map((preset) => {
            const isActive = Object.entries(preset.parameterValues).every(
              ([key, val]) => instance.parameterValues[key] === val
            );
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(activePart, preset.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: 9,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                  background: isActive ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.15s',
                }}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      )}

      {/* 数字参数滑块 */}
      {gene.parameters
        .filter((param) => param.type === 'number')
        .map((param) => (
          <ParamSlider
            key={param.id}
            param={param}
            value={typeof instance.parameterValues[param.id] === 'number' ? instance.parameterValues[param.id] as number : (param.defaultValue as number)}
            onChange={(v) => updateParameter(activePart, param.id, v)}
          />
        ))}

      {/* Select 类型参数 */}
      {gene.parameters
        .filter((param) => param.type === 'select')
        .map((param) => (
          <div key={param.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>{param.label}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {param.options?.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => updateParameter(activePart, param.id, opt.value)}
                  style={{
                    padding: '2px 6px',
                    fontSize: 8,
                    borderRadius: 3,
                    border: '1px solid var(--border)',
                    background: instance.parameterValues[param.id] === opt.value ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                    color: instance.parameterValues[param.id] === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: instance.parameterValues[param.id] === opt.value ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}

      {/* 约束违规提示 */}
      {instance.violations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
          {instance.violations.map((v) => (
            <div
              key={v.ruleId}
              style={{
                fontSize: 8,
                padding: '3px 6px',
                borderRadius: 3,
                background: v.level === 'error' ? 'rgba(220,20,60,0.1)' : 'rgba(255,165,0,0.1)',
                color: v.level === 'error' ? '#DC143C' : '#FF8C00',
                border: `1px solid ${v.level === 'error' ? 'rgba(220,20,60,0.2)' : 'rgba(255,165,0,0.2)'}`,
              }}
            >
              {v.level === 'error' ? 'ERROR' : 'WARN'}: {v.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 单个参数滑块 */
function ParamSlider({ param, value, onChange }: {
  param: GeneParameter;
  value: number;
  onChange: (v: number) => void;
}) {
  const min = (param.min ?? 0);
  const max = (param.max ?? 100);
  const step = (param.step ?? 1);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>{param.label}</span>
        <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {value}{param.unit ? ` ${param.unit}` : ''}
        </span>
      </div>
      <div style={{ position: 'relative', height: 14, display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: '100%',
            height: 4,
            appearance: 'none',
            WebkitAppearance: 'none',
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--border) ${pct}%, var(--border) 100%)`,
            borderRadius: 2,
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}
