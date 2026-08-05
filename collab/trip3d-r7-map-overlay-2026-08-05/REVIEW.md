# GOAL/REVIEW — R7 底图路网叠加(2026-08-05)

## 调研结论
monolith 自带「Map overlay」实为**分层设色/等高线着色参数**,并非路网数据叠加——R7 从「核实」升级为「新增真实 OSM 路网叠加」。

## 实现
- dem.js 返回 tileX0/tileY0/tilesAcross(slippy 网格与 DEM 完全同格)
- buildMapOverlay:按 DEM 同 z/x/y 网格取 OSM 标准瓦片拼 canvas → CanvasTexture;单片失败留空白格;terrainGen 代际防陈旧;bitmap close
- terrain.js:uOverlayTex/uOverlayMix uniform;fragment 在 ramp 后、等高线下按世界 XZ 采样混合(v 轴 flipY 修正:北=v1)
- 快捷开关 🛣 路网叠加(layer buttons),mix 0.55
- Codex review 阻塞(usage limit,同 R6 runbook 登记)

## E2E 验收
| 项 | 结果 |
|---|---|
| 测试/构建 | ✅ 143/143 + exit 0 |
| 叠加渲染 | ✅ OSM 地名文字正向(无镜像)、路网贴合地形起伏 |
| 开关 | ✅ ON mix=0.55 纹理显示;OFF mix=0 纹理保留但不可见(切换零重载) |
