# REVIEW — L2 行政区划交互（方案 A）

## 结果

- 实现 `🏛` 双阶段交互：首次开启图层，已开启时再次点击打开/关闭图层卡；卡内开关负责关闭。
- 图层卡展示省/市/县 breadcrumb、自动/省/市/县层级、智能标签、实际段数、图例、DataV 与缓存状态。
- 行政边界改为冷蓝三级（市浅蓝、县蓝灰虚线）；标签取消白盒，改透明底白 halo。
- 查看模式独立消费地图拾取；即使规划开启，也不会新增途经点。点击选区显示详情，Esc 清除选择并退出。
- z12 零段显示“当前视图完全位于…内”，并修复 finally 时序导致空态不刷新的问题。
- 图层开启后 DEM key 变化自动重载。
- 移动端 bottom sheet 从 52px rail 右缘开始，层级高于 attribution，主要触控目标 44px。
- `aria-pressed` 与 `aria-expanded` 分离，键盘 focus-visible 与状态区语义明确。

## TDD / 验证

- 新增 15 项行为测试：状态机、最深命中、重载判定、按钮语义、DOM、ARIA。
- 全量：31 files / 196 tests passed。
- build：成功；app `index-Cw42urgO.js`，CSS `index-BBxIwW4C.css`。
- 桌面 CDP：z10 7 段/24 region/14 scene children；县级过滤；中心点击选中察哈尔右翼后旗；规划 waypoint 0→0；Esc 恢复；z12 零段文案可见。
- 移动 CDP 390×844：sheet 338×388，left=52，地图保留 456px，无溢出；层级按钮与主操作均 44px。
- 浏览器控制台：0 JS errors。
- 视觉复核：桌面卡无互压；移动端修复 rail/attribution 遮挡后通过。

## 已知边界

- 中国 DataV only；境外仍安全降级。
- 本 Goal 不做区域面填充、路线穿越统计、完整 GIS 属性表。
- 行政区“聚焦”移动 controls target，不自动改变缩放。
