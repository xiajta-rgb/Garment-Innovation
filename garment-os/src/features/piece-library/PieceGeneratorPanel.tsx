/** All generator entry points use the active, reviewed complete draft. */
import { useDesignStore } from '@/store/useDesignStore';
import { isReferencePattern } from '@/data/patternReview';
import { BrianGeneratorPanel } from './BrianGeneratorPanel';
import { StandardGeneratorPanel } from './StandardGeneratorPanel';
export function PieceGeneratorPanel() {
  const id = useDesignStore(s => s.activePatternId);
  if (!isReferencePattern(id)) return <div role="alert">模板缺少完整制图依据，生成已阻断。</div>;
  return id === 'brian-reference' ? <BrianGeneratorPanel /> : <StandardGeneratorPanel key={id} />;
}
