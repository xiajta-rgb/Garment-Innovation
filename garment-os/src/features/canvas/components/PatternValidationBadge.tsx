import { Popover } from 'antd';
import { useDesignStore } from '@/store/useDesignStore';

/** Displays the application result; never maintains a second validator in the UI. */
export function PatternValidationBadge() {
  const draft = useDesignStore(s => s.draft);
  const blocked = draft.status === 'blocked';
  return <Popover title="参考制图检查" content={<div style={{ maxWidth: 380 }}>
    {draft.issues.map((issue, i) => <p key={`${issue.ruleId}:${i}`} style={{ color: issue.level === 'error' ? '#cf1322' : '#874d00' }}>{issue.message}</p>)}
    <p>生产交付还需材料条件、缝合配对、试坯与交换文件核验。</p>
  </div>}>
    <span role="status" style={{ fontSize: 12, color: blocked ? '#cf1322' : '#874d00', padding: '2px 10px' }}>
      {blocked ? '制图受阻' : '参考几何 · 生产待验收'}
    </span>
  </Popover>;
}
