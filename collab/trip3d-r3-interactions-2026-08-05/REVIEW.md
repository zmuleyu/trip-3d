# REVIEW — Codex review(R3 规划交互,2026-08-05)

结论:**REJECT(P0 仲裁/阈值)** → 全部处理。

| # | 问题 | 处理 |
|---|---|---|
| P0 | 无 pointer capture/cancel/blur 清理;controls.enabled 无条件恢复 | `endMarkerDrag(commit)`:pointerId 绑定;pointercancel + window blur 清理;prevEnabled 恢复 |
| P0 | 按下即 moved,抖动触发 revision churn | **5px 屏幕阈值**才入 dragging;未过阈值松手不 commit、也不穿透成地形打点(实测 2px 抖动 rev 不变) |
| — | capture 阶段仲裁 | 原有设计被确认必要(OrbitControls 先绑定,capture 抢先禁用) |

## E2E 验收(2026-08-05,dev)

| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 123/123(insertWaypoint clamp/revisions) |
| 构建 | ✅ exit 0 |
| 拖拽改线 | ✅ P2 拖动坐标更新、**镜头零移动**(capture 仲裁)、pointerup 单次 revision |
| 抖动仲裁 | ✅ 2px 抖动无 commit;标记点击不穿透成新点 |
| 段中插入 | ✅ 行间 ⊕ → 点击地形插入第 2 位(P1,P4,P2,P3) |
| 拖拽排序 | ✅ DataTransfer drag/drop:P1 移至第 3 位 |
| ESC | ✅ 插入模式 ESC 优先取消(insertIndex),再退规划 |
| 视觉 | ✅ 时间轴/摘要卡/详情/路线渲染均正常 |
