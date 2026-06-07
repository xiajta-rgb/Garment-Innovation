# Debug Session: sketch-layeredpaths-undefined

**Status**: [RESOLVED]
**Date**: 2026-06-07
**Symptom**: `TypeError: Cannot read properties of undefined (reading 'push')` at GarmentSketch.tsx:46:25

**Error Stack**:
```
TypeError: Cannot read properties of undefined (reading 'push')
    at GarmentSketch (http://localhost:5341/src/features/canvas/components/GarmentSketch.tsx:46:25)
    at Object.react_stack_bottom_frame
    at renderWithHooks
    ...
```

**实际 vs 预期**:
- 实际: 浏览器加载画布时崩溃
- 预期: 画布正常渲染所有路径 (含新工业符号)

---

## Hypotheses (Falsifiable)

### H1: LAYER_ORDER 与扩展后的 layer 类型不同步
- 论据: Milestone B 把 layer 扩展到 11 种 (cutting/seam/grain/fold/notch/dart/drill/stitch/detail/outline/annotation), 但 LAYER_ORDER 只有 3 种
- 测试点: 对照 types/gene.ts layer 联合类型 vs GarmentSketch LAYER_ORDER
- **已确认**: grep 结果

### H2: layeredPaths 对象只初始化 3 个数组
- 论据: 初始化 `{ outline: [], stitch: [], detail: [] }`, 其他 8 种 layer 没有对应数组
- 测试点: 当 pathData.layer === 'cutting-line' 时, layeredPaths['cutting-line'] 为 undefined
- **已确认**: 直接读源码

### H3: 路径里现在有 cutting-line/grain-line 等新 layer
- 论据: body.ts 改成 `layer: 'cutting-line'`, sleeve.ts 同样, markings.ts 输出 grain-line/notch
- 测试点: 在路径数据中能找到新 layer 值
- **已确认**: 上一轮已修改

**根因**: H1 + H2 + H3 同时成立 → 当 body outline (cutting-line) / grain line / notch 等新符号路径经过时, 触发 undefined.push

---

## Static Analysis Evidence (预插桩证据)

`GarmentSketch.tsx:18-21`:
```ts
const LAYER_ORDER = ['outline', 'stitch', 'detail'] as const;  // ← 3 个
```

`types/gene.ts:114-127` (扩展后):
```ts
layer?: 'cutting-line' | 'seam-line' | 'grain-line' | 'fold-line' | 'notch' | 'dart' | 'drill-hole' | 'stitch' | 'detail' | 'outline' | 'annotation';  // ← 11 个
```

`GarmentSketch.tsx:46`:
```ts
layeredPaths[layer].push({  // ← layer 可能是 'cutting-line', 但数组不存在
```

---

## Fix Solution

**最小修复**: 把 LAYER_ORDER 扩展到全部 11 种, 并把 layeredPaths 初始化对应所有数组。同时在 push 前加兜底 (防御未来新增 layer 类型)。

```ts
const LAYER_ORDER = [
  'cutting-line', 'seam-line', 'grain-line', 'fold-line',
  'notch', 'dart', 'drill-hole', 'stitch', 'detail', 'outline', 'annotation',
] as const;
```

并改为:
```ts
const layeredPaths = Object.fromEntries(
  LAYER_ORDER.map((k) => [k, [] as ...])
) as Record<LayerType, ...[]>;
```

push 前加 `||= []` 兜底:
```ts
if (!layeredPaths[layer]) layeredPaths[layer] = [] as any;
layeredPaths[layer].push(...);
```

---

## Plan
- [x] H1/H2/H3 静态分析证据
- [x] 最小修复 (扩展 LAYER_ORDER + 兜底)
- [ ] 验证: tsc 通过 + 浏览器加载画布无错
- [ ] 等待用户确认
