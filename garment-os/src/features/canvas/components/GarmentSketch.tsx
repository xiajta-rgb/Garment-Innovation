import { useMemo } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { usePieceQC } from '@/features/piece-library/usePieceQC';
import { measurePieceBboxFull } from '@/lib/pattern/piece-registry';
import { getFabricSvgPattern } from '@/data/fabrics';
import { ReferenceSymbols } from './ReferenceSymbols';
import type { PatternLayer } from '@/types/pattern';
const LAYERS: PatternLayer[] = ['cutting-line','seam-line','grain-line','fold-line','notch','dart','drill-hole','stitch','detail','outline','annotation'];
const CLEAN = new Set<PatternLayer>(['cutting-line','seam-line','stitch','detail','outline','annotation']);
/** Pure source-path presentation. No fallback geometry, proportions or invented marks. */
export function GarmentSketch({ view, garmentColor }: { view:'front'|'back'; garmentColor:string }) {
  const { visiblePieces } = usePieceQC();
  const mode = useDesignStore(s => s.viewMode), fabricId = useDesignStore(s => s.fabricId);
  const activePart = usePieceLibraryStore(s => s.activePart);
  const paths = visiblePieces.filter(p => p.view === view || p.view === 'all').flatMap(p => p.paths).filter(p => mode === 'industrial' || CLEAN.has(p.layer!));
  const pattern = useMemo(() => getFabricSvgPattern(fabricId),[fabricId]);
  const b = paths.length ? measurePieceBboxFull(paths) : {minX:0,minY:0,maxX:100,maxY:100};
  const viewBox = `${b.minX-20} ${b.minY-20} ${b.maxX-b.minX+40} ${b.maxY-b.minY+50}`;
  return <svg id="garment-sketch" data-testid="garment-sketch" viewBox={viewBox} style={{width:'85%',height:'auto'}}>
    <ReferenceSymbols />
    {pattern && <defs dangerouslySetInnerHTML={{__html:pattern}} />}
    {LAYERS.map(layer => <g key={layer} data-layer={layer}>{paths.filter(p => p.layer === layer).map(p => {
      const filled = layer === 'seam-line', active = p.category === activePart;
      return <g key={p.id}>
        <path data-piece-category={p.category} data-source-id={p.id} data-piece-id={p.pieceId} d={p.data} transform={p.transform}
          fill={filled ? garmentColor : 'none'} fillOpacity={filled ? .15 : undefined} stroke={p.stroke} strokeWidth={p.strokeWidth + (active ? .3 : 0)}
          strokeDasharray={p.strokeDasharray} strokeLinecap={p.strokeLinecap} markerStart={p.markerStart} markerEnd={p.markerEnd} />
        {filled && pattern && <path d={p.data} transform={p.transform} fill={`url(#fabric-${fabricId})`} stroke="none" opacity={.25} />}
      </g>;
    })}</g>)}
    {!paths.length && <text x="50" y="50" textAnchor="middle" fontSize="5" fill="#777">当前筛选没有可显示的参考裁片</text>}
  </svg>;
}
