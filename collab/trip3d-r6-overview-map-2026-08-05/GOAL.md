# GOAL — R6 2D 全程总览小地图(inset overview)

## 最终目标
右下角 inset 小地图(~200×150 canvas):
1. OSM 栅格瓦片按路线 bbox 拼接(纯函数:bbox→瓦片范围,瓦片数 ≤16 自动降 zoom)
2. 叠加:路线折线(accent)+ 途经点(绿起/灰经/红终)+ **当前 3D 视野框**(地形世界 AABB→lon/lat 矩形)
3. 联动:路线变更/DEM 加载/相机移动(节流 500ms)重绘;inset 点击 → flyTo 对应位置(可选,简单做)
4. ≥2 途经点且 real DEM 时显示,否则隐藏;小图带 © OSM 标注

## 非目标
inset 内拖拽编辑;多源底图切换;高清屏适配打磨

## 验收
- TDD:slippy 换算/bbox→zoom/投影往返
- E2E:乌兰哈达环线导入后 inset 显示全程+视野框;点击 inset 飞达;拖动相机视野框跟随
- review 处理;build ✓;closeout+发布
