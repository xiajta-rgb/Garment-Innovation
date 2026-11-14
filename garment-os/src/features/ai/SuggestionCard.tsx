import type { DesignSuggestion } from '@/application/design-suggestion';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
export function SuggestionCard({ suggestion,applied,onApply }: { suggestion:DesignSuggestion;applied:boolean;onApply:()=>void }) {
  const available = !!suggestion.templateId && suggestion.unmetRequirements.length === 0;
  return <div style={{ marginTop:8,fontSize:11,lineHeight:1.7 }}>
    <b>{suggestion.name}</b><p>{suggestion.description}</p>
    <p>参考模板：{suggestion.templateId ? PATTERN_LIBRARY[suggestion.templateId]?.name : '没有相符模板'}</p>
    {suggestion.unmetRequirements.length > 0 && <div role="status">未满足：{suggestion.unmetRequirements.join('；')}</div>}
    <p>颜色建议：{suggestion.colorSuggestions.join(' · ') || '无'}</p>
    <p>面料建议：{suggestion.fabricSuggestions.join(' · ') || '无'}</p>
    <p>{suggestion.rationale}</p>
    <button onClick={onApply} disabled={!available || applied}>{applied ? '已选择参考模板' : available ? '选择该参考模板' : '构型未齐备，不能应用'}</button>
    <p>建议与参考模板均不代表生产验收。</p>
  </div>;
}
