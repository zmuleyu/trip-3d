# REVIEW — Codex review(P2.5 RouteLayer 升级,2026-08-04)

结论:**REJECT(4 条)** → 全部处理。

| # | 问题 | 处理 |
|---|---|---|
| P0 | `this._elevOfWorld` getter 未调用即传入 sampleRoutePath,ele=函数对象 → 坡度色/统计/剖面全 NaN | **E2E 先于 review 抓到**(统计卡 NaN);修为 `const elevOf = this._elevOfWorld()` 后传入;E2E 复验 ↑39m ↓76m 最高 1586m 正常 |
| P1 | 共享 ARROW_GEO/ARROW_MAT 被 _clear 按子对象重复 dispose,资源所有权错误 | _clear 跳过共享资源(`o.geometry === ARROW_GEO` 判断);layer 持有所有权 |
| P1 | 箭头数量无上限(1000km→3333 Mesh) | 硬上限 MAX_ARROWS=120,arrowStep = max(300m, totalM/120) 自适应 |
| P2 | PLAN 写 three@0.182 实际 0.172 | PLAN.md 更正;API 在 0.172 均存在,无需升级 |

## 过程亮点
- **E2E 视觉先行抓到 P0**:review 返回前,视觉验收（统计卡 NaN）已定位 getter 契约 bug。数据探针（`instanceColorStart` 采样）证明顶点色正确注入，避免误判色带未生效
- 线宽两轮调校：2.6/4.6（套管吃线）→ 4.0/6.0（套管过粗）→ **4.0/5.0**（视觉确认达标）
- 箭头锥体 0.28×0.85 → **0.11×0.34**（世界单位，近景不遮挡）；箭头避开刻度 ±120m

## E2E 验收(V6,2026-08-04)

| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 71/71(66 既有 + slopeStyle 5) |
| 构建 | ✅ exit 0 |
| 双层 Line2 | ✅ casing 5.0px + main 4.0px,vertexColors,resolution 同步 |
| 坡度渐变 | ✅ 顶点色数组=采样数-1;Monument Valley 平缓地形全绿(正确);色带分级逻辑由单测锁定 |
| 旗/箭头/刻度 | ✅ 绿旗起点/红旗终点;15 cone(≤120 上限);1k-4k 刻度 |
| 剖面联动 | ✅ hover→3D 十字光标出现;click→flyTo 相机飞行([0,18,19]→[7.1,4.3,8.1]) |
| Route style 开关 | ✅ lil-gui folder 就位(设置抽屉内) |
| 无回归 | ✅ 打点/ESC/统计/剖面正常 |
| 视觉 | ✅ 三轮截图迭代后确认「完全达标」 |
