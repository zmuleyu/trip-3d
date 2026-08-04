# GOAL — R2 规划面板布局重构(时间轴+行内操作+方案卡+逐段)

## 最终目标
规划面板从功能堆叠重构为高德式信息层级:
1. **途经点时间轴列表**:🟢起/⚪经/🔴终色点+竖线;行内 hover 操作:删除/上移/下移/重命名
2. **方案摘要卡**:大号总时长+次级里程/爬升/天气指数(有结果时),accent 描边
3. **逐段明细折叠**:「详情 ▾」→ 每段一行(里程/爬升/示意时长);吸附=OSRM legs 真实分段,未吸附=计算分段
4. 版面:搜索→时间轴→吸附行→摘要卡→详情→按钮行

## 非目标
拖拽排序/多日分段(R3);线路库/天气/剖面改动;amap 功能(R1 已交付)

## 验收(Definition of Done)
- 单元测试全绿(新增:osrm legs、computeLegs、行内操作与 revision 联动)
- E2E:时间轴渲染+色点;删除/上下移/重命名生效且 revision 自增;snap 开启时逐段显示真实 OSRM 分段;摘要卡大号时长
- Codex review 处理完毕;build ✓;closeout + CF Pages 发布

## 关键设计
- osrm.js 扩展返回 legs: [{ distanceM, durationS }](fixture 更新)
- snapState.legs 绑定 revision,失效规则同 geometry
- 未吸附分段:computeLegs(waypoints, elevOf)(haversine+启发式,纯函数)
- 行内操作走 removeWaypoint/moveWaypoint + revision++ + refreshRoute + scheduleSnap(R1 原子模式)
