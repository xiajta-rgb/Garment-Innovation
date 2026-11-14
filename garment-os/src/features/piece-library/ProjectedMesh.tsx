import { useMemo } from 'react';
import { cameraBasis, projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import type { PatternMesh3d, XY } from '@/types/pattern3d';
import type { RenderView } from './physical-renderer';
import { viewportGrid } from '@/lib/pattern/mesh/viewport-grid';

const line = (points: XY[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const colors = ['#96c8a2', '#c4b5fd', '#f4cd93'];

/** Same physical projection and picking as WebGL; no graphics context is needed. */
export function ProjectedMesh({ model, camera, size, visible, selected, wire, seams, grid=true,anchors }: RenderView & { model: PatternMesh3d }) {
  const projected = useMemo(() => {
    const ids = new Set(visible), basis = cameraBasis(camera);
    return model.panels.map((panel, index) => ({ panel, index }))
      .filter(({ panel }) => ids.has(panel.id))
      .map(({ panel, index }) => ({ panel, index,
        points: panel.positionsMm.map(p => projectPhysicalPoint(p, camera, size)),
        depth: panel.positionsMm[0].reduce((s, n, k) => s + n * basis.forward[k], 0),
      })).sort((a, b) => a.depth - b.depth);
  }, [model, camera, size, visible]);
  const ids = new Set(visible);
  return <>
    {grid&&<g data-testid="projected-floor-grid" fill="none" strokeWidth=".7">{viewportGrid(model).lines.map((line,i)=><path key={i} d={`M${projectPhysicalPoint(line.a,camera,size).join(' ')} L${projectPhysicalPoint(line.b,camera,size).join(' ')}`} stroke={line.axis==='x'?'#765153':line.axis==='z'?'#485f7c':'#3d4048'}/>)}</g>}
    {projected.map(({ panel, points, index }) => <g key={panel.id}>
      <path data-projected-panel={panel.id} d={`${line(points)} Z`}
        fill={colors[index % colors.length]} stroke={panel.id===selected?'#f1b673':'#65717f'} strokeWidth={panel.id===selected?'2':'1'} />
      {wire && <path data-projected-wire={panel.id} fill="none" stroke="#475569" strokeWidth="0.6"
        d={Array.from({ length: panel.triangles.length / 3 }, (_, i) => `${line(panel.triangles.slice(i * 3, i * 3 + 3).map(n => points[n]))} Z`).join(' ')} />}
    </g>)}
    <g fill="none" stroke="#c2410c" strokeWidth="1">
      {seams && model.seams.filter(seam => ids.has(seam.aPanel) && ids.has(seam.bPanel)).map(seam =>
        <path key={seam.id} data-projected-seam={seam.id} d={seam.samples.map(sample => line([
          projectPhysicalPoint(sample.a, camera, size), projectPhysicalPoint(sample.b, camera, size),
        ])).join(' ')} />)}
      {anchors.length === 2 && <path d={line(anchors.map(anchor => projectPhysicalPoint(anchor.worldMm, camera, size)))} />}
    </g>
  </>;
}
