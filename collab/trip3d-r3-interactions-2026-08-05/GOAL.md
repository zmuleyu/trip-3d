# GOAL — R3 规划交互三件套(拖拽改线/段中插入/拖拽排序)

## 最终目标
1. **拖拽改线**:按住途经点标记(sprite)拖动 → pointermove 射线落地形实时 moveWaypoint + refreshRoute;pointerup → scheduleSnap;拖拽期间 OrbitControls 禁用、打点抑制
2. **段中插入 ⊕**:时间轴行间 ⊕ → insertIndex 模式 → 下次地形点击 insertWaypoint(index);ESC/再点取消;insertWaypoint 纯函数 TDD
3. **拖拽排序**:时间轴行 draggable,drop 处 moveWaypoint(from, to)

## 非目标
多日分段(itinerary 模型,与分享闭环同波);触控专项;拖动中实时吸附(松手才吸附,防抖)

## 验收
- 测试全绿(insertWaypoint/边界/联动)
- E2E:标记拖拽改线(镜头不动、坐标更新、松手重吸附);行间 ⊕ 插入;行拖拽换位
- review 处理;build ✓;closeout+发布

## 风险点(review 关注)
- 拖拽 vs 轨道旋转 vs 打点的事件仲裁(pointerdown 命中标记 → 禁用 controls + 标记 dragged,抑制 click 落点)
- sprite raycast 精度(小目标);命中半径放宽
- 拖拽中 geometryRevision 频繁自增 → 仅在 pointerup 时自增一次(拖动中走临时坐标,不落 revision)
