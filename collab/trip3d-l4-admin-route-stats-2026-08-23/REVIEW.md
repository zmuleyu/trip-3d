# REVIEW — L4 路线穿越行政区统计

## 结果

- 新纯函数模块 `src/lib/adminRouteStats.js`：`computeRegionRouteStats(routePoints, region, { maxSegmentMeters })` 与 `formatRouteStats`。
  - 线段-环边参数求交 → 按 t 切分子段 → 中点做 `adminBoundaries.pointInRing` 射线判定（与 findDeepestAdminRegion 同款）→ 外→内跳变计 entries（起点在区内计 1 次），haversine 累计区内里程。
  - 稀疏段按 `maxSegmentMeters`（默认 500m）弧长增密，与 route.js samplePolyline 同策略。
  - 输入支持 `[[lon,lat]]` 与 `{lon,lat}` 两种点形；非法输入返回 null。
- 详情卡新增「路线」行（`<dt>路线</dt><dd data-field="route-stat">`），`routeStat` 为 null 时整行隐藏；新增 `setRouteStat(text)` 供异步结果单独落行。
- `main.js`：`scheduleAdminRouteStat()` — setTimeout 异步 + 序号 stale guard；refreshAdminUI（选区/图层/层级变化）与 refreshRoute（路线变化）双触发；`!adminState.on || !selected || lastRoutePts.length < 2` 置 null，图层关闭即清除且不触发计算。

## TDD / 验证

- 新增 15 项测试（adminRouteStats 13 + adminPanel 2）：单次穿越、区内全程、区外、Z 字两次进入、终点在区内、起点在区内、闭合环等价、稀疏增密、对象点、非法输入、格式化三档；面板行显示/隐藏与 setRouteStat。
- 全量：32 files / 211 tests passed（196 → 211）。
- build：成功；app `index-CiX6_n-a.js`，CSS `index-BBxIwW4C.css`（未变）。
- 桌面 CDP E2E（chrome-debug@9222，经 7897 代理，乌兰察布 z10 分享链接恢复 2 途经点）：
  - 选中察哈尔右翼后旗（150928）→ 详情卡显示「进入 1 次 · 预计途经 35 km」（路线全程 35.1 km 在区内，一致）。
  - 关闭图层 → 选区清除、详情卡与统计行隐藏；重开重选 → 重算恢复。
  - 退出查看模式加 P3（路线折返出区）→ 重算为「进入 2 次 · 预计途经 48 km」。
  - 控制台 0 JS 错误；截图 `desktop-e2e.png` 视觉复核通过。

## 已知边界

- 统计基于 Catmull-Rom/吸附后的显示折线（lastRoutePts，240 采样）；环为 DataV 简化边界，里程为近似值（文案「预计」）。
- 行政区环在 viewport bbox 外被裁剪；选中区的 ring 是完整环（regions 未裁剪），统计用完整环，无边界截断误差。
- 计算为同步数学（选中区一环 × 240 段），经 setTimeout 让出主线程；未上 Worker，规模下无必要。
