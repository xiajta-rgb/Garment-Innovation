import { Path } from '@freesewing/core';
import type { AssemblyEdge, AssemblyPiece, AssemblyPoint, MaterialCut } from '@/types/assembly';
import type { PieceMaterialRole } from '@/types/piece-taxonomy';

interface SourcePath { ops: Array<{ type: string; to?: AssemblyPoint; cp1?: AssemblyPoint; cp2?: AssemblyPoint }> }
interface SourcePart { points: Record<string, AssemblyPoint>; paths: Record<string, SourcePath> }
const copy = (p: AssemblyPoint) => ({ x: p.x, y: p.y });

/** Exact source operations and core curve integration, with no sampled or bbox lengths. */
function captureEdges(path: SourcePath, requireClosed: boolean): AssemblyEdge[] {
  const edges: AssemblyEdge[] = [];
  let origin: AssemblyPoint | undefined, from: AssemblyPoint | undefined;
  for (const op of path.ops) {
    if (op.type === 'move') {
      if (origin) throw new Error('结构接口含多个子路径，需显式拆分');
      origin = from = op.to;
      continue;
    }
    const to = op.type === 'close' ? origin : op.to;
    if (!from || !to) throw new Error('结构边缺少端点');
    const segment = new Path().move(from);
    if (op.type === 'curve' && op.cp1 && op.cp2) segment.curve(op.cp1, op.cp2, to);
    else if (op.type === 'line' || op.type === 'close') segment.line(to);
    else throw new Error(`不支持的结构边操作：${op.type}`);
    const lengthMm = segment.length();
    // FreeSewing often closes an already closed contour with a zero-length Z.
    if (lengthMm > 1e-8) edges.push({ id: `e${edges.length + 1}`, kind: op.type === 'curve' ? 'curve' : 'line',
      from: copy(from), to: copy(to), cp1: op.cp1 ? copy(op.cp1) : undefined, cp2: op.cp2 ? copy(op.cp2) : undefined, lengthMm });
    from = to;
  }
  if (!origin || !from || (requireClosed && Math.hypot(origin.x - from.x, origin.y - from.y) > 1e-7)) throw new Error('结构净样未闭合');
  return edges;
}

export function captureAssemblyPiece(part: SourcePart, info: { id: string; name: string; engine: string; version: string;primaryMaterial?:PieceMaterialRole }, cutlist: Record<string, unknown>, internalPaths:string[]=[]): AssemblyPiece {
  const rawMaterials = structuredClone(cutlist.materials ?? {}) as Record<string, MaterialCut[]>;
  const materials=Object.fromEntries(Object.entries(rawMaterials).map(([name,cuts])=>{
    if(!Array.isArray(cuts))throw new Error(`${info.id} 材料指令不是数组`);
    return [name,cuts.map(c=>{if(![true,false,0,1].includes(c.onFold))throw new Error(`${info.id} 对折指令无效`);return {...c,onFold:!!c.onFold};})];
  }));
  const fabric = materials[info.primaryMaterial??'fabric'] ?? [];
  if (!fabric.length || fabric.some(c => !Number.isInteger(c.cut) || c.cut <= 0)) throw new Error(`${info.id} 缺少有效主材料裁剪数量`);
  if (new Set(fabric.map(c => !!c.onFold)).size !== 1) throw new Error(`${info.id} 混合对折方式，需拆分结构身份`);
  return { ...info, quantity: fabric.reduce((sum, c) => sum + c.cut, 0), onFold: !!fabric[0].onFold, materials,
    points: Object.fromEntries(Object.entries(part.points).filter(([key]) => !key.startsWith('_')).map(([key, p]) => [key, copy(p)])),
    edges: captureEdges(part.paths.seam, true),
    internalPathKinds:Object.fromEntries([...internalPaths.map(id=>[id,'placement' as const]),...(part.paths.placketCut?[['placketCut','cut' as const]]:[])]),
    internalPaths: Object.fromEntries([...new Set([...internalPaths,...(part.paths.placketCut?['placketCut']:[])])].map(id=>{
      if(!part.paths[id])throw new Error(`源定位路径不存在：${id}`);
      return [id,captureEdges(part.paths[id],false)];
    })) };
}
