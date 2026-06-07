# Debug Session: vsc-module-cache-persistent

**Status**: [RESOLVED]
**Date**: 2026-06-07
**Symptom**: VSC 编辑器持续显示 `DesignToolbar.tsx:3 找不到模块"./SavedDesignsList"或其相应的类型声明。`
即便之前 `Write` 重写 SavedDesignsList.tsx 触发了 mtime 更新, 诊断曾暂时清空, 用户报告问题**仍然存在**。

**实际 vs 预期**:
- 实际: VSC 持续报模块解析错误
- 预期: VSC 能正常解析 `./SavedDesignsList` 模块引用

**已知事实**:
- `tsc --noEmit` 通过 ✓
- SavedDesignsList.tsx 文件存在 ✓
- 文件编码正常 (UTF-8, 无 BOM) ✓
- `export function SavedDesignsList` 命名导出正常 ✓
- DesignToolbar.tsx 中 `import { SavedDesignsList } from './SavedDesignsList'` 路径正确 ✓
- 上一次 `Write` 操作曾让诊断临时消失, 但问题再次出现

---

## Hypotheses (Falsifiable)

### H1: VSC TS server 持久化缓存未清除
- 论据: VSC TS server 可能在内存外有持久化缓存 (.tsbuildinfo / .cache/), Write 操作只更新了 in-memory 状态
- 测试点: 删除 `node_modules/.vite/`、`tsconfig.tsbuildinfo` 等缓存
- 验证方法: 检查文件 mtime 后, 重启 Vite/VSC, 观察诊断

### H2: SavedDesignsList 内部有 TS server 无法解析的语法/类型问题
- 论据: 之前发现 `SavedDesignsList` 含 `await import('@/lib/db/design-db')` 动态导入, 如果 design-db 有循环依赖或类型错误, TS server 可能将该文件标记为"有错误"
- 测试点: 检查 design-db.ts 是否有类型错误, SavedDesignsList 的依赖链
- 验证方法: tsc 输出应会显示错误, 但目前 tsc 通过 - 排除或缩小范围

### H3: 模块解析路径在 VSC 中有别名问题 (`@/...`)
- 论据: `tsconfig.json` 的 `paths` 映射 (`@/*` → `src/*`) 可能在 TS server 中行为不同
- 测试点: 改用相对路径 `../design-sheet/SavedDesignsList` 测试
- 验证方法: 修改导入路径, 重启 TS server

### H4: Vite HMR 模块图缓存了"未找到"状态
- 论据: Vite dev server 的 moduleGraph 在文件创建前已记录"找不到", Write 触发的 mtime 更新 HMR 不一定能完全 invalidate
- 测试点: 完全重启 Vite dev server
- 验证方法: `Stop-Process` 杀掉所有 node 进程, 重启 `npm run dev`

### H5: VSC 编辑器实例的本地缓存未同步
- 论据: VSC 的 `tsc-watch` 进程在 VSC 进程内, 重启 VSC 或 Reload Window 才能清
- 测试点: 用户执行 `Developer: Reload Window`
- 验证方法: 由用户操作, 观察 VSC 状态

---

## Plan
- [x] Step 1: 重新确认 SavedDesignsList.tsx 的实际状态 (mtime, encoding, 内容) — 全部正常
- [x] Step 2: 列出所有相关文件 mtime — SavedDesignsList 13:05, DesignToolbar 13:05
- [x] Step 3: 检查 design-db.ts — 内容正确, 修复后已应用
- [x] Step 4: 杀掉所有 Vite 进程, 完全重启 dev server — 杀掉 6 个僵尸进程
- [x] Step 5: 清理 Vite 缓存 — 21MB 清理
- [x] Step 6: 重新触发 VSC 诊断 — **H4 验证: 清理后诊断依然存在 → 排除 H4**
- [x] Step 7: 根因确定 — `--traceResolution` 证明 tsc 能解析, 错误只在 VSC tsserver 中
- [x] Step 8: 最小修复 — 将相对路径 `'./SavedDesignsList'` 改为 path alias `@/features/design-sheet/SavedDesignsList`
- [x] Step 9: 验证 — `tsc --noEmit` 通过, `GetDiagnostics` 返回 `[]`
- [ ] Step 10: 等待用户确认 (浏览器刷新 VSC)
