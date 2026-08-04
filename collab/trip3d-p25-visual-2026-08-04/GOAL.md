# GOAL — trip-3d P2.5 视觉冲刺包(路线规划视觉)

## 最终目标
把路线视觉从「1px 橙线」拉到竞品平均线以上,6 个独立小件:
1. **描边套管 casing**:深色粗线垫底 + 橙线在上(Line2 双层)
2. **坡度顶点渐变**:按 segment 坡度上色(Caltopo 分级:<5° 绿 / 5-15° 黄 / 15-25° 橙 / >25° 红)
3. **起点旗/终点旗** sprite 替换首末圆点 + 沿线**方向箭头**(flat cone mesh,每 ~300m)
4. **剖面↔3D 十字联动**:悬停剖面卡 → 3D 线上对应位置光标;点击剖面 → flyTo
5. **距离刻度 sprite**:每 1km 一个(长线自动 5km 间隔)
6. **样式开关**:lil-gui 新增「Route style」folder(设置抽屉内):坡度渐变/箭头/刻度 三个 bool,默认全开

## 验收标准
1. `npm test` 全绿(66 既有 + 新增坡度配色/刻度间隔纯函数测试)
2. `npm run build` exit 0
3. E2E(远程浏览器,`window.__exp` 已暴露 scene/terrain/route/geo/dem):打 3 点后——双层线存在且宽度正确;顶点色数组与采样点数一致;首末旗 sprite;箭头 mesh 数量≈里程/300m;刻度 sprite 数量≈里程/1km;剖面 hover 出现 3D 光标;点击剖面触发相机飞行;截图视觉确认
4. 无回归(打点/ESC/保存/天气色带等 P2 功能)

## 非目标(红线)
- 不做:海拔帷幕、bloom/flow 光效、日照分析、飞越视频(P3);坡度地形着色、雪线(P4)
- 不改数据模型(route/store/share/gpx 结构不动)
- 不动 providers/weather 逻辑
- 不引入新框架;保持无构建链外的依赖(three examples 内部件可用)

## 约束
- 单 writer;Conventional Commits;纯函数一律 TDD 先行
- 既有 66 测试必须保持绿;build 必须绿
- 视觉件属 three.js 胶水层,不做无意义单测,E2E 实测为准
