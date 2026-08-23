# GOAL — L4 路线穿越行政区统计

- 来源：docs/admin-boundary-ui-ux-competitive-research-2026-08-13.md §3.5 / §5 波次 4（可选增强，用户已拍板实施）。
- 目标形态：行政区详情卡在有路线时显示「路线：进入 2 次 · 预计途经 38 km」；无路线隐藏该行。
- 核心：纯函数 `src/lib/adminRouteStats.js` + TDD；详情卡在 `adminInteraction.selected` 时异步计算。
- 重算触发：选中区划变化、路线变化；稀疏路线按既有弧长 resample 策略增密。
- 门禁：行政图层关闭时统计不触发。

## 验收

1. 现有 196 tests 全绿 + 新增统计测试全绿。
2. build 成功。
3. 桌面 CDP E2E：详情卡出现穿越行；图层关闭后统计不触发/行隐藏。
4. push origin/main，生产 trip-3d.pages.dev 资产与本地一致。

Git 身份：Hermes Agent <hermes@local>。单 writer 串行。
