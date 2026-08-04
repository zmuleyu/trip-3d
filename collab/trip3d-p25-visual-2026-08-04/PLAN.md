# PLAN — P2.5 视觉冲刺包

| # | 任务 | 验证 | 依赖 |
|---|---|---|---|
| V1 | 控制面恢复:读本目录 STATE/CHECKPOINT,更新为 IN_PROGRESS | — | — |
| V2 | `src/lib/slopeStyle.js`:slopeColorOf(deg)、tickIntervalM(distanceM)、纯函数 + TDD | vitest 绿 | V1 |
| V3 | RouteLayer 升级:Line2 双层(casing+主线)+ vertexColors + 旗 sprite + 箭头 cone + 距离刻度 | build + E2E | V2 |
| V4 | 剖面联动:profileCard 增 onHover/onSelect 回调;main.js 接 3D 光标 sprite + flyTo | E2E | V3 |
| V5 | lil-gui「Route style」folder 三开关 + params | E2E | V3 |
| V6 | 全量验收 + 截图 + closeout(commit/STATE/followups) | GOAL 标准 | V5 |

## 仓库事实(worker 必读)
- Repo `D:\projects\creative_group\trip-3d`,main @ `7c1a03b`,66 tests 绿,vite+vitest+three@0.172
- `src/route/RouteLayer.js`:现 THREE.Line(1px)+ makeNumberSprite;**构造签名 = getter 注入**(`() => terrain.sample` / `() => geo` / `() => elevOfWorld`)——terrain.rebuild 会替换 sampler,禁止按值捕获
- `src/lib/route.js`:`sampleRoutePath(geo, waypoints, elevOf, nSamples=240)` 返回 `[{x,z,lon,lat,ele,cumDistM}]`(等弧长);`routeStats(pts)`;`routeFingerprint(route)`
- `src/lib/geo.js`:`lonLatToWorld(geo, lon, lat)` → `{x,z}`;TERRAIN_SIZE=56;场景高度用 `terrain.sample(x,z)`(含夸张)
- three fat lines: `import { Line2 } from 'three/addons/lines/Line2.js'` + `LineGeometry`(setPositions/setColors)+ `LineMaterial({ linewidth, vertexColors, resolution })`——**resolution 必须每帧/resize 同步**(renderer.getSize),否则线宽错误
- casing 做法:两个 Line2 同 positions,底层 linewidth×1.8、颜色用 ink(#17191b)或不透明深橙,主线 accent #ff4d00
- 箭头:THREE.ConeGeometry 放平(rotateX π/2 后按 bearing=atan2(dx,dz) 绕 Y 旋),y=terrain.sample+0.25;每 ~300m 一个,沿 cumDistM 插值取位
- 刻度/旗:canvas sprite(参考 RouteLayer 现有 makeNumberSprite 模式);tickIntervalM:<8km 用 1km,8-40km 用 5km,>40km 用 10km
- flyTo 现成(main.js `flyTo(pos, target)`);剖面卡 canvas 在 `src/ui/panels.js` createProfileCard,加 `{ onHover(i), onSelect(i) }` 可选回调,i=采样点 index;main.js 侧维护一个 crosshair sprite(group 于 routeLayer.group)
- 剖面 canvas 内部坐标:y 轴已被晴雨色带占用顶部(profileTop 变量),hover 映射只需 x→index:`i = round((mx-10)/(W-20)*(pts.length-1))`,clamp
- 鼠标事件挂 profile canvas:mousemove/mouseleave/click
- E2E 环境教训(必读,前两个 goal 记录):① DOM 变更后 a11y ref 重映射,点击前先 browser_snapshot;可疑时 console `el.click()` 直验;② 长字符串 console 截断,落文件读;③ 远程浏览器空闲清 IDB;④ dev server 可能已在 5199 跑着(vite,strictPort;占用则直接复用,换端口 5200 也可)
- 验证命令:`npm test`、`npm run build`、E2E 用 browser_* 工具;`window.__exp` 暴露 { scene, camera, controls, params, terrain, loadRealTerrain, labels, route, geo, dem }

## Codex review
V3 完成后跑一次 `codex exec --sandbox read-only` review(CODEX_HOME='C:\Users\Admin\.codex-hermes'),聚焦 fat-lines 资源泄漏(dispose)、resize 同步、性能(每帧重建?禁止——只在线路变更时重建)。发现问题修订后再进 V4。

## 阻塞点
- 无外部凭证;three addons 已在依赖内(three@0.182 自带 examples/jsm)
