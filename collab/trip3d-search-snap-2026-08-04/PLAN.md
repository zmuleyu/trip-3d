# PLAN — 搜索+吸附+多点天气

| # | 任务 | 验证 | 依赖 |
|---|---|---|---|
| G1 | 控制面 + PLAN + Codex review 后台 | review 结论 | — |
| G2 | `src/providers/geocode.js`(nominatim/photon/amap-stub)+ TDD | vitest | G1 |
| G3 | `src/providers/osrm.js` + routing.js 注册 + TDD | vitest | G1 |
| G4 | `src/lib/route.js` 加 `samplePolyline`(任意折线等弧长采样)+ TDD | vitest | — |
| G5 | 搜索 UI:规划面板搜索框+下拉+飞达+⊕加途经点(界内直接加,界外先载 DEM 再加) | build+E2E | G2 |
| G6 | 吸附集成:开关/分段缓存/requestId+指纹防串线/降级/统计真实里程/RouteLayer pathPts 注入 | build+E2E | G3 G4 |
| G7 | 多点天气:weatherPanel「全部途经点」开关接入 runWeatherQuery | E2E | — |
| G8 | review 回补 + 全量验收 + closeout | GOAL 标准 | G5-7 |

## 技术事实(已实测)
- Nominatim: `https://nominatim.openstreetmap.org/search?q={q}&format=jsonv2&limit=6&accept-language=zh` — 实测四姑娘山返回正常;浏览器 fetch 自动带 Referer(政策允许);防抖 350ms;结果字段 lat/lon/display_name/type/importance
- Photon: `https://photon.komoot.io/api/?q={q}&limit=6` — GeoJSON,properties.name/state/country,geometry.coordinates=[lon,lat]
- OSRM: `https://router.project-osrm.org/route/v1/foot/{lon,lat};{lon,lat}?overview=full&geometries=geojson` — 实测 21.5km/3094s;响应 code=Ok,routes[0].geometry.coordinates=[[lon,lat]...],distance/duration;演示服务器仅轻量使用
- 接口形态(与骨架对齐): geocode `search(query, limit) → [{name,displayName,lon,lat,type,importance}]`;routing `route(points[{lon,lat}]) → {geometry[[lon,lat]],distanceM,durationS}`
- 分段缓存:key=`${a.lon.toFixed(5)},${a.lat.toFixed(5)}→${b...}` → Promise<segment>;并发去重(同 key 复用 Promise)
- 吸附 pts 管线: 分段 geometry 拼接 → `samplePolyline(geo, coords, elevOf, 240)` → 与样条 pts 同构 → RouteLayer.update(waypoints, { pathPts }) 注入;未吸附时 pathPts=null 走原样条
- RouteLayer.update 现签名 (waypoints, opts);opts 加 pathPts(可选,null=样条)
- 防串线: 吸附请求带 routeFingerprint + requestId(复用天气的成熟模式)
- 界内判定: `geo.lonLatToPx(lon,lat)` → px∈[0,dem.size-1] 为界内;界外流程: 设 params.demLat/Lon → loadRealTerrain() → 完成后 addWaypoint + flyTo
- 分享: encodeShare 不变(只存 waypoints);打开时若 snap 开关开 → 自动重吸附
- amap stub: geocode/routing 各注册 stub,方法调用 throw Error('amap provider 占位:待 key+GCJ-02+条款评估,见 followups')

## Codex review 焦点
Nominatim 浏览器约束、OSRM demo 限制(https/坐标数)、分段缓存竞态、界外打点流程、吸附与天气指纹的交互
