# GOAL — 2D 精确规划 + 3D 地形预览生产实施

## 目标

将已批准的方案 B 落到生产：显式路线模式、2D 精确打点工作区、同步 3D 预览、DEM 超覆盖保护、移动端 bottom sheet，并修复设置抽屉与 Tab 折叠问题。

## 验收标准

- Route 持久化 `mode: straight|foot|car`，分享与线路库往返不丢。
- 直线模式不再显示驾车 40km/h 伪耗时；路网失败/混合段不冒充可靠总时长。
- 规划态可在 2D OSM 工作区点击加点，右侧保留实时 3D 预览；可切回全屏 3D。
- 路线超出当前 DEM 时不采样高程、不显示剖面/爬升，提供自动扩展地形动作。
- 移动端 390×844：bottom nav + planning sheet，地图可见且主操作 ≥44px，无横向溢出。
- 关闭设置抽屉时内部控件 inert/aria-hidden；天气/分享 Tab 不继承规划折叠态。
- `npm test`、`npm run build`、桌面与移动 CDP E2E 全绿，生产资产与本地一致。

## 非目标

- 不引入 MapLibre/Leaflet 或新后端。
- 不实现多方案路由、自托管 OSRM、高德实体 provider。
- 不重构行政区划、天气数据或分享视频业务。
