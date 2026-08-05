# REVIEW — Codex review(R5 深度编辑,2026-08-05)

结论:**REJECT(设计契约)** → 全部处理(多条在实施中已内建)。

| # | 问题 | 处理 |
|---|---|---|
| C1 | undo 栈与 revision/在途请求一致性 | 快照只含 waypoints+dayEnds;apply 时双 revision 自增 → snap/weather 自动失效;加载/GPX/hash/boot 全部 `history.reset` |
| C2 | 快照粒度 | 全量 JSON 深拷贝(≤32 点,增量逆操作复杂度被拒);cap 50;dedup 防抖 |
| C3 | **dayEnds 索引漂移** | **id-based dayEnds**(toggler 存 waypoint.id);normalizeDayEnds 过滤失效 id;dayNumberAt 按位置推导;删点/移点/反向测试锁定跟随语义 |
| C4 | closeLoop 环线判定/去重 | 0.0003° 阈值 + copy 新 id(非别名);<2 点 no-op;测试锁定 |
| C5 | exclude 缓存 key 一致性 | **实测 FOSSGIS routed-car 不支持 exclude(InvalidValue)→ UI 整体撤下**(不做假承诺);provider 保留 exclude+优雅降级(TDD),自托管路径入 followups |
| — | share days 持久化 | v1 可选字段(向后兼容):编码 id→索引,解码校验整数+范围,复原映射新 id;store 保留 wp id 使 dayEnds 跨会话有效 |

## 实施期 E2E 抓到的新问题

| 问题 | 修法 |
|---|---|
| 避高速吸附静默失败(InvalidValue) | provider 级 InvalidValue→无 exclude 重试+`excludeIgnored` 标记(TDD);UI 撤下 |
| Ctrl+Z/Y 与表单编辑冲突 | keydown 处理器跳过 INPUT/TEXTAREA/SELECT 聚焦态 |
| 远端浏览器 E2E 中途掉 about:blank | 重导航复验(环境问题,非应用 bug) |

## E2E 验收(2026-08-05,dev)

| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 137/137(history 4 + edit 6 + exclude 3 + ta/days 等) |
| 构建 | ✅ exit 0 |
| Undo/Redo | ✅ Ctrl+Z 3→2→1,Ctrl+Y 回到 2;面板撤销/重做按钮同栈 |
| 反向/闭环 | ✅ P1,P2→P2,P1;闭环后首尾同点(新 id) |
| 多日分段 | ✅ ☀ toggle → D1/D2/D2 徽标;剖面 D1 虚线;store/hash 双路持久化 |
| 避高速 | ✅ 实测 FOSSGIS InvalidValue;UI 已撤;provider 降级测试锁定 |
