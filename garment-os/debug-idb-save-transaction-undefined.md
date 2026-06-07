# Debug Session: idb-save-transaction-undefined

**Status**: [RESOLVED]
**Date**: 2026-06-07
**Symptom**: 点击 Save 按钮 → `TypeError: Cannot read properties of undefined (reading 'transaction')` at design-db.ts:69:18

**Error Stack**:
```
TypeError: Cannot read properties of undefined (reading 'transaction')
    at DesignDB.saveDesign (http://localhost:5341/src/lib/db/design-db.ts:69:18)
    at async saveDesign (http://localhost:5341/src/store/parametricStore.ts:213:4)
```

**实际 vs 预期**:
- 实际: Save 按钮报错, 设计未保存
- 预期: 设计保存到 IndexedDB, currentDesignId 设置成功

---

## Hypotheses (Falsifiable)

### H1: `getDB()` 在某些代码路径下 resolve 为 `undefined`
- 论据: TypeScript 类型签名是 `Promise<IDBDatabase>` (非 nullable), 但运行时 `db` 变量是 `undefined`
- 测试点: 在 `getDB()` resolve 处插桩, 打印 `this.db` 实际值
- 验证方法: 触发 Save, 观察日志

### H2: `indexedDB.open()` 成功回调被调用两次, 第二次 `request.result` 异常
- 论据: Vite HMR 多次加载模块可能导致 `request` 复用, 旧 callback 关闭 db, 新 callback 拿到无效 result
- 测试点: 记录 `request.result` 类型和值
- 验证方法: 在 onsuccess / onerror 插桩, 检查调用次数和 db 状态

### H3: `db` 实例在 HMR 重新创建后, 旧 instance 的 `getDB()` 闭包仍引用新 instance, 但新 instance 未初始化
- 论据: `export const db = new DesignDB()` 在 HMR 时会被重新执行, 创建新 instance; 但 old reference 的 saveDesign 可能调用 new instance 的方法, 而 new instance 的 `this.db` 是 null
- 测试点: 记录 `this.db` 状态转换, instance identity
- 验证方法: 在 `getDB()` 入口插桩, 打印 instance hash

### H4: `this.dbReady` 在 HMR 模式下被错误地共享, resolve 时 `this.db` 是 null
- 论据: 互斥锁的 `this.dbReady` 在 HMR 时被保留 (因为 dbReady 是个 promise), 但 `this.db = null` 在 onclose 中
- 测试点: 检查 `this.dbReady` 状态
- 验证方法: 打印 `this.db` 和 `this.dbReady` 的所有状态变化

### H5: `indexedDB` 在浏览器上下文被禁用或抛出, 但错误被吞掉
- 论据: 浏览器隐私模式或 IndexedDB 配额问题会导致 open 失败, 但 promise 在 finally 块中已被 resolve
- 测试点: 检查 `indexedDB` 全局可用性
- 验证方法: 在 `getDB()` 入口检查 `typeof indexedDB`

---

## Plan
- [ ] Step 1: 在 `getDB()` 入口和出口插桩 (H1, H3, H4)
- [ ] Step 2: 在 `indexedDB.open` success/error 回调插桩 (H2, H5)
- [ ] Step 3: 在 saveDesign 入口插桩
- [ ] Step 4: 触发 Save, 收集日志
- [x] Step 5: 根据证据确定根因 → **H6: getDB() 缺失 return**
- [x] Step 6: 最小修复 (1 行添加 `return this.dbReady;`)
- [x] Step 7: 验证修复 — `npx tsc --noEmit` 通过
- [ ] Step 8: 等待用户确认 (浏览器中触发 Save 按钮)
- [ ] Step 9: 清理插桩

---

## Static Analysis Finding (预插桩证据)

**关键代码片段** (design-db.ts:22-66):
```ts
private async getDB(): Promise<IDBDatabase> {
  if (this.db) return this.db;
  if (this.dbReady) return this.dbReady;
  this.dbReady = new Promise((resolve, reject) => {  // ← 仅赋值，无 return
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => { ... };
    request.onsuccess = () => { ... };
  });
  // ← 函数在这里结束，没有 return 语句
}
```

**问题**: async 函数最后一行 `this.dbReady = new Promise(...)` 只设置成员变量，没有 `return` 语句。函数隐式返回 `undefined`，被 async 包装为 `Promise<undefined>`。

**调用链**:
1. `saveDesign()` → `const db = await this.getDB();`  → `db === undefined`
2. `db.transaction(...)` 抛错 `Cannot read properties of undefined (reading 'transaction')`

**修复** (1 行): `getDB()` 末尾添加 `return this.dbReady;`
