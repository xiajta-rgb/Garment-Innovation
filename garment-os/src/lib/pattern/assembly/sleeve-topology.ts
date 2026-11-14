import type { AssemblyDefinition, AssemblyFinding, BoundaryRole } from '@/types/assembly';

/** Structural requirements independent of length. A diagonal decoration cannot satisfy these ports. */
export function auditSleeveTopology(def: AssemblyDefinition): AssemblyFinding[] {
  const t = def.sleeveTopology;
  if (!t) return ['teagan', 'sven', 'brian'].includes(def.engine)
    ? [{ code: 'sleeve-topology', subject: def.id, message: '基础装袖方法缺少前身、后身、袖片的结构声明' }] : [];
  const errors: AssemblyFinding[] = [];
  const fail = (subject: string, message: string) => errors.push({ code: 'sleeve-topology', subject, message });
  const parts = [t.front, t.back, t.sleeve].map(id => def.pieces.find(p => p.id === id));
  if (new Set([t.front, t.back, t.sleeve]).size !== 3 || parts.some(p => !p)) {
    fail(def.id, '前身、后身、袖片必须是三个独立且存在的裁片身份'); return errors;
  }
  const roles = (i: number) => parts[i]!.boundaries.map(b => b.role);
  const requireRoles = (i: number, required: BoundaryRole[], forbidden: BoundaryRole[]) => {
    for (const role of required) if (!roles(i).includes(role)) fail(parts[i]!.id, `缺少结构接口：${role}`);
    for (const role of forbidden) if (roles(i).includes(role)) fail(parts[i]!.id, `此袖型不允许接口：${role}`);
  };
  if (t.family === 'set-in') {
    for (const i of [0, 1]) requireRoles(i, ['shoulder', 'armhole', 'neckline'], ['raglan-front', 'raglan-back']);
    requireRoles(2, ['sleevecap', 'underarm'], ['neckline', 'raglan-front', 'raglan-back']);
  } else {
    requireRoles(0, ['raglan-front', 'neckline'], ['shoulder', 'armhole']);
    requireRoles(1, ['raglan-back', 'neckline'], ['shoulder', 'armhole']);
    requireRoles(2, ['raglan-front', 'raglan-back', 'neckline', 'underarm'], ['shoulder', 'sleevecap']);
    for (const [i, role] of [[0, 'raglan-front'], [1, 'raglan-back']] as const) {
      const body = parts[i]!, sleeve = parts[2]!;
      const connected = def.joins.filter(j => {
        const connects = (a: typeof j.a, b: typeof j.b) => a.some(u => u.piece === body.id && body.boundaries.some(v => v.id === u.boundary && v.role === role))
          && b.some(u => u.piece === sleeve.id && sleeve.boundaries.some(v => v.id === u.boundary && v.role === role));
        return j.roles.every(r => r === role) && (connects(j.a, j.b) || connects(j.b, j.a));
      });
      if (connected.length !== 1) fail(body.id, '前、后插肩缝必须分别与袖片对应接口配对，不能合计抵消差值');
    }
  }
  return errors;
}
