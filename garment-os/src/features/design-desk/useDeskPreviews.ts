import { useEffect, useState } from 'react';
import type { DeskCandidate } from '@/application/design-desk';
import type { TeeFlatSpecification } from '@/lib/pattern/tee-flat-pattern';
interface Preview { revision: string; id: string; svg?: string; specification?:TeeFlatSpecification; pieces?: number; error?: string }
export function useDeskPreviews(candidates: DeskCandidate[]) {
  const items = candidates.filter(c => c.configuration).map(c => ({ id: c.id, configuration: c.configuration }));
  const revision = JSON.stringify(items), [replies, setReplies] = useState<Record<string, Preview>>({});
  useEffect(() => {
    if (!JSON.parse(revision).length) return;
    let active = true;
    const worker = new Worker(new URL('./desk-preview.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<Preview>) => { if (active && e.data.revision === revision) setReplies(previous => ({ ...previous, [e.data.id]: e.data })); };
    worker.onerror = () => { if (active) setReplies(Object.fromEntries(JSON.parse(revision).map((item: { id: string }) => [item.id, { revision, id: item.id, error: '三视图计算未完成，请调整后重试。' }]))); };
    worker.postMessage({ revision, items: JSON.parse(revision) });
    return () => { active = false; worker.terminate(); };
  }, [revision]);
  return Object.fromEntries(Object.entries(replies).filter(([, value]) => value.revision === revision));
}
