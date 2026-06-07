import { useParametricStore } from '@/store/parametricStore';
import type { GenderType } from '@/types/gene';

/** 性别切换器 (Male / Female) */
export function GenderSwitcher() {
  const gender = useParametricStore((s) => s.gender);
  const setGender = useParametricStore((s) => s.setGender);

  const options: { value: GenderType; label: string; icon: React.ReactNode }[] = [
    {
      value: 'male',
      label: 'Male',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="13.5" r="5.5" /><line x1="21" y1="3" x2="14.5" y2="9.5" /><polyline points="16,3 21,3 21,8" /></svg>,
    },
    {
      value: 'female',
      label: 'Female',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="6" /><line x1="12" y1="16" x2="12" y2="22" /><line x1="9" y1="19" x2="15" y2="19" /></svg>,
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setGender(opt.value)}
          style={{
            flex: 1,
            padding: '6px 8px',
            fontSize: 10,
            borderRadius: 4,
            border: '1px solid',
            borderColor: gender === opt.value ? 'var(--accent)' : 'var(--border)',
            background: gender === opt.value ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
            color: gender === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: gender === opt.value ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.15s',
          }}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
