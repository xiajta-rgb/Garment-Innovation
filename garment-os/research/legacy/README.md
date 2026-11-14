# 历史实现归档

本目录保留本轮整理前的模拟 Gene/DAG、旧画布、BOM/成本猜算、旧制图与已被替换的合同和脚本。它们已退出运行入口。

完整清单和文件原始 SHA256 在 `../../doc/evidence/architecture-20261110/retired-files.json`；`npm run check:architecture` 同时校验这些备份的完整性。

- 归档不是当前可运行模块。原 `@/` 路径指向旧布局；请勿直接导回系统。
- Vitest、TypeScript 与 ESLint 的生产检查不执行本目录。历史通过次数不能用于当前验收。
- `verify-shape-collaboration.py` 是一次性迁移复核脚本，包含视图设置写入，已退出常规运维。不要按原“never writes”注释直接运行。
- 旧 E2E 脚本保留为历史来源。当前浏览器工作流在 `scripts/e2e-reference.mjs`，本轮尚未完成浏览器执行。
- 如果需要恢复，请按清单取回原文件，在隔离分支重新设计边界并完成检查；保留现行实现和用户数据。

本轮没有清空 IndexedDB、删除飞书记录或新建飞书台账。
