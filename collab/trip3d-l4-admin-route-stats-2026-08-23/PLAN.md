# PLAN — L4 路线穿越行政区统计

1. 控制面：本目录 GOAL/PLAN/STATE。
2. TDD-RED：
   - `src/lib/adminRouteStats.test.js`：穿越计数（进入 1/2 次、起点在区内、终点在区内、完全在外）、区内里程（haversine 容差）、稀疏路线增密、非法输入。
   - `src/ui/adminPanel.test.js`：详情卡穿越行显示/隐藏。
3. 实现 `src/lib/adminRouteStats.js`：
   - `computeRegionRouteStats(routePoints, region, { maxSegmentMeters })` → `{ entries, distanceMeters } | null`。
   - 点入环判定复用 `adminBoundaries.pointInRing`（与 findDeepestAdminRegion 同款射线法）。
   - 线段-环边求交 → 按 t 切分子段 → 中点判定内外 → haversine 累计区内里程；外→内跳变计 entries；起点在区内计 1 次。
   - 稀疏段按 maxSegmentMeters 弧长增密（与 route.js 弧长 resample 同策略）。
   - `formatRouteStats(stat)` → `进入 N 次 · 预计途经 X km`。
4. 接线：
   - `adminPanel.js`：详情卡加 `<dt>路线</dt><dd data-field="route-stat">`，update 接受 `routeStat`，null 时隐藏。
   - `main.js`：`scheduleAdminRouteStat()` 异步（setTimeout + 序号 stale guard），refreshAdminUI 与 refreshRoute 触发；`!adminState.on || !selected || lastRoutePts.length < 2` 时置 null。
5. 全量测试 + build。
6. 桌面 CDP E2E。
7. REVIEW → commit → push → 生产核验 → CHECKPOINT/STATE 收尾。
