# PLAN

1. RED/GREEN：路线模式、耗时展示、DEM 覆盖检测与 fit 参数纯函数。
2. 接线 Route/Store/Share：mode 持久化与旧数据兼容。
3. 重构规划面板：直线/步行/驾车分段控件，可信度与覆盖状态。
4. 扩展 overviewMap 为 2D 规划工作区；新增 2D/3D workspace bar。
5. 接入超覆盖保护与“扩展地形范围”动作。
6. 响应式 CSS：桌面双工作区、移动 bottom sheet/bottom nav；修复 settings inert 与 Tab 折叠。
7. 全量测试/build，CDP 桌面/移动/超覆盖 E2E，代码评审修复。
8. commit + push；轮询 CF Pages 生产资产并做 hash/实驾验收；REVIEW/CHECKPOINT/STATE 收尾后最终提交推送。
