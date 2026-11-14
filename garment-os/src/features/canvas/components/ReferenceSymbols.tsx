import { REFERENCE_MARKERS } from '@/lib/pattern/reference/symbols';
export function ReferenceSymbols() {
  return <defs>{Object.entries(REFERENCE_MARKERS).map(([id,d]) => <marker key={id} id={`reference-${id}`} orient="auto" refX="0" refY="0" markerWidth="12" markerHeight="8" style={{ overflow: 'visible' }}><path d={d} fill="#0f766e" stroke="none" /></marker>)}</defs>;
}
