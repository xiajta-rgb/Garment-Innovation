import { useParametricStore } from '@/store/parametricStore';

/**
 * BOM 成本面板
 * - 4 个汇总卡 (Material / Labor / Tariff / Total FOB)
 * - BOM 明细列表
 */
export function BomCostPanel() {
  const costBreakdown = useParametricStore((s) => s.costBreakdown);

  if (!costBreakdown) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* 成本汇总 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <CostCard label="Material" value={costBreakdown.materialCost} currency={costBreakdown.currencyCode} />
        <CostCard label="Labor" value={costBreakdown.laborCost} currency={costBreakdown.currencyCode} />
        <CostCard label="Tariff" value={costBreakdown.tariffCost} currency={costBreakdown.currencyCode} />
        <CostCard label="Total FOB" value={costBreakdown.totalCost} currency={costBreakdown.currencyCode} highlight />
      </div>

      {/* BOM 明细 */}
      {costBreakdown.bomItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>BOM Items</span>
          {costBreakdown.bomItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '3px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{item.componentName}</span>
                <span style={{ fontSize: 7, color: 'var(--text-muted)' }}>{item.usage} {item.unit}</span>
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {item.cost.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 单个成本卡 (含高亮模式用于总计) */
function CostCard({ label, value, currency, highlight }: {
  label: string;
  value: number;
  currency: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      padding: '6px 8px',
      borderRadius: 4,
      background: highlight ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
      border: highlight ? '1px solid var(--accent)' : '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 7, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color: highlight ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
        {currency === 'CNY' ? '\u00a5' : '$'}{value.toFixed(2)}
      </div>
    </div>
  );
}
