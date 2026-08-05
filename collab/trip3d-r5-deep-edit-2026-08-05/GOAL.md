# GOAL — R5 规划深度编辑四件套(undo/redo·反向/闭环·多日分段·避高速)

## 最终目标
1. **Undo/Redo 编辑栈**:快照栈(waypoints 深拷贝,geometryRevision 变更入栈,cap 50);Ctrl+Z/Ctrl+Y+面板按钮;redo 在新编辑时清空
2. **路线快捷操作**:一键反向(reverseWaypoints)、一键闭环(closeLoop:非环线时追加起点);时间轴上方操作行
3. **多日分段基础版**:route.dayEnds = [waypoint indices];行内操作「设为第 N 天终点」切换;时间轴显示「D1/D2…」日徽标+分隔;剖面色带按日分界竖线;store/hash 持久化
4. **驾车避开高速**:car profile 加 exclude=motorway 切换(OSRM exclude 参数);缓存 key 含 exclude

## 非目标
分段级吸附控制、路线偏好全菜单、方案气泡、触控专项

## 验收
- 测试全绿(history 栈/reverse/closeLoop/dayEnds 序列化/exclude URL)
- E2E:多次编辑后 Ctrl+Z 逐步回退+Ctrl+Y 重做;反向/闭环;设 2 个日终点后时间轴日徽标+剖面日界线;避高速吸附 URL 含 exclude=motorway
- review 处理;build ✓;closeout+发布
