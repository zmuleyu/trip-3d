# P0+P1 打点成线 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在 monolith-terrain 底座上实现「点击 3D 地形落途经点 → 样条贴地连线 → 里程/高程剖面 → 线路库(IndexedDB+GPX+URL 分享)」核心闭环。

**Architecture:** 纯函数核心(`src/lib/`: 坐标换算 / 线路模型 / 持久化序列化,全部 TDD 单测)+ 薄 three.js 胶水层(`src/route/`: 渲染与交互,人工验收)。不接任何路由引擎与天气 API;全链路 WGS-84,无影像底图。坐标换算严格复刻 `src/dem.js` 的瓦片数学与 `src/terrain.js` 的世界映射,保证双向可逆。

**Tech Stack:** Vite + three.js 0.172(已导入)· vitest + jsdom + fake-indexeddb(新增 dev 依赖)· IndexedDB · GPX 1.1 · URL hash(base64url JSON)

**上游设计文档:** `D:\projects\creative_group\brainstorming\2026-08-04-3d-trip-weather-planner-brainstorm.md` §4 MVP 定义 / §5 分期 P0-P1

**已知上下文(已读文件,关键发现):**
- `src/dem.js`(82 行全读):`loadDem({lat,lon,zoom,tilesAcross=3})` 返回 `{data,size,metersPerPixel,extentMeters,minM,maxM,meanM,lat,lon,zoom}`;`size = tilesAcross*256 = 768`;瓦片画布以 `(cx,cy)` 为中心取 3×3;`sampleDem(dem,px,py)` 双线性采样。
- `src/terrain.js`(关键段):`TERRAIN_SIZE=56`;`_makeDemSampler` 世界→像素 `px = (x/TERRAIN_SIZE + 0.5) * (size-1)`;纵向 `scale = (TERRAIN_SIZE/dem.extentMeters)*params.demExaggeration`;`rebuild(params)` 用 `sample(x,z)` 逐顶点采样。
- `src/main.js`(关键段):`loadRealTerrain()`(L574)加载 DEM 后 `terrain.setDem(dem)` + `regenerateTerrain()`;`flyTo(pos,target)` tween(L282);tour 系统(Catmull-Rom+梯形速度,L294-);pointer 目前只有 `pointermove`(L557);lil-gui 与剪贴板模式(L621-642)可复用。
- `package.json`:deps 仅 lil-gui/postprocessing/three;scripts 仅 dev/build/preview。

**v1.0 必须(本 plan 全部):** 点击落点 / 样条贴地线 / 里程·爬升·示意耗时 / 高程剖面图 / 线路库 CRUD / GPX 导入导出 / URL 分享 / 坐标双向可逆换算
**v1.1+ defer(写入 docs/followups.md):** 途经点拖拽改线、途经点重命名 UI、undo/redo、多线路同屏、路网吸附(高德/openrouteservice)、天气(P2)、分享视频(P3)、移动端触控优化

---

## Requirements

- **R1** 用户可在规划模式下点击 3D 地形落下途经点(最多 32 个), markers 带序号标签
- **R2** 途经点间以 Catmull-Rom 样条连接并贴地渲染(抬升防 z-fighting)
- **R3** 实时统计:总里程(haversine)、爬升/下降、示意驾驶耗时(按地形启发式,标注「示意」)
- **R4** 底部高程剖面面板:折线图 + 最高/最低海拔标注
- **R5** 线路库:命名保存/列表/加载/删除,IndexedDB 持久化,刷新不丢
- **R6** GPX 1.1 导出(下载 .gpx)与导入(文件选择),往返无损
- **R7** URL hash 分享:编码 {dem 中心, zoom, waypoints} → base64url;打开链接即复原线路与地形
- **R8** 坐标换算 `lonLatToWorld` / `worldToLonLat` 双向可逆(误差 < 1e-6°),与 dem.js/terrain.js 数学严格一致
- **R9** `src/providers/` 下 RoutingProvider / WeatherProvider 接口骨架(JSDoc 类型 + NotImplemented 存根),P4 扩展点,本 plan 不实现

## P0 — 基础设施与纯函数核心

### Task 1: vitest 测试基建

**Objective:** 引入 vitest/jsdom/fake-indexeddb,一个冒烟测试跑通。

**Files:**
- Modify: `package.json`(devDependencies + scripts.test)
- Create: `vitest.config.js`
- Test: `src/lib/smoke.test.js`

**Step 1: 安装依赖**

Run: `npm install -D vitest@^3 jsdom@^26 fake-indexeddb@^6`
Expected: package.json devDependencies 出现三项

**Step 2: 写冒烟测试**

Create `src/lib/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest'

describe('test infra', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

**Step 3: 配置**

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // per-file override: `// @vitest-environment jsdom` for DOMParser/IDB tests
  },
})
```

`package.json` scripts 增加: `"test": "vitest run"`

**Step 4: Run test**

Run: `npm test`
Expected: `1 passed`

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/lib/smoke.test.js
git commit -m "test: add vitest infrastructure"
```

**Acceptance:** `npm test` → exit 0, `Test Files 1 passed`
**Covers:** 基础设施(无业务需求)
**Execution:** serial

---

### Task 2: 坐标换算模块 `geo.js`(R8 核心)

**Objective:** WGS-84 经纬 ↔ DEM 画布像素 ↔ three.js 世界坐标,双向可逆;haversine 里程。纯函数,不依赖 three。

**Files:**
- Create: `src/lib/geo.js`
- Test: `src/lib/geo.test.js`

**数学依据(必须严格一致,摘自源码):**
- dem.js: `n = 2**zoom`;`cx = floor(((lon+180)/360)*n)`;`cy = floor(((1 - ln(tan(lat)+1/cos(lat))/π)/2)*n)`;画布 3×3 瓦片,左上角全局瓦片 `(cx-1, cy-1)`;`size = 768` px。
- terrain.js: 世界→像素 `px = (x/56 + 0.5) * (size-1)`;逆变换 `x = (px/(size-1) - 0.5) * 56`。

**Step 1: Write failing test**

Create `src/lib/geo.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { makeGeoContext, lonLatToWorld, worldToLonLat, haversineMeters } from './geo.js'

// z12, 3×3 tiles → size 768; context mirrors dem.js tile math
const dem = { lat: 36.998, lon: -110.0984, zoom: 12, size: 768 }
const geo = makeGeoContext(dem)

describe('geo', () => {
  it('round-trips lon/lat → world → lon/lat', () => {
    for (const [lon, lat] of [[-110.0984, 36.998], [-110.05, 37.01], [-110.15, 36.96]]) {
      const w = lonLatToWorld(geo, lon, lat)
      const back = worldToLonLat(geo, w.x, w.z)
      expect(back.lon).toBeCloseTo(lon, 6)
      expect(back.lat).toBeCloseTo(lat, 6)
    }
  })

  it('world origin maps inside the DEM canvas', () => {
    const { px, py } = geo.worldToPx(0, 0)
    expect(px).toBeGreaterThan(0)
    expect(px).toBeLessThan(768)
    expect(py).toBeGreaterThan(0)
    expect(py).toBeLessThan(768)
  })

  it('pxToLonLat matches dem.js forward math at canvas corners', () => {
    // canvas (0,0) = NW corner of tile (cx-1, cy-1)
    const nw = geo.pxToLonLat(0, 0)
    const se = geo.pxToLonLat(768, 768)
    expect(se.lon).toBeGreaterThan(nw.lon)
    expect(se.lat).toBeLessThan(nw.lat)
    // 3 tiles at z12 ≈ 0.2637° lon span
    expect(se.lon - nw.lon).toBeCloseTo((3 / 2 ** 12) * 360, 4)
  })

  it('haversine: 1° lat ≈ 111.195 km', () => {
    expect(haversineMeters(0, 0, 1, 0)).toBeCloseTo(111195, -2)
  })

  it('world +x = east, +z = south', () => {
    const a = worldToLonLat(geo, 0, 0)
    const east = worldToLonLat(geo, 5, 0)
    const south = worldToLonLat(geo, 0, 5)
    expect(east.lon).toBeGreaterThan(a.lon)
    expect(south.lat).toBeLessThan(a.lat)
  })
})
```

**Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/geo.test.js`
Expected: FAIL — `Cannot find module './geo.js'`

**Step 3: Write implementation**

Create `src/lib/geo.js`:

```js
// WGS-84 lon/lat ↔ DEM canvas px ↔ three.js world coordinates.
// Pure module (no three.js). Math MUST mirror src/dem.js (tile canvas)
// and src/terrain.js (world→px mapping: px = (x/TERRAIN_SIZE + 0.5) * (size-1)).

export const TERRAIN_SIZE = 56 // keep in sync with src/terrain.js
const TILE_PX = 256
const EARTH_R = 6371008.8 // IUGG mean radius, meters

export function makeGeoContext(dem) {
  // dem: { lat, lon, zoom, size } — same shape loadDem() returns
  const n = 2 ** dem.zoom
  const latRad = (dem.lat * Math.PI) / 180
  const cx = Math.floor(((dem.lon + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  const tilesAcross = dem.size / TILE_PX
  const half = Math.floor(tilesAcross / 2)
  const originX = cx - half // global tile coords of canvas NW corner
  const originY = cy - half
  const span = dem.size - 1

  function worldToPx(x, z) {
    return { px: (x / TERRAIN_SIZE + 0.5) * span, py: (z / TERRAIN_SIZE + 0.5) * span }
  }
  function pxToWorld(px, py) {
    return { x: (px / span - 0.5) * TERRAIN_SIZE, z: (py / span - 0.5) * TERRAIN_SIZE }
  }
  function pxToLonLat(px, py) {
    const gx = originX + px / TILE_PX // global tile coords (fractional)
    const gy = originY + py / TILE_PX
    const lon = (gx / n) * 360 - 180
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * gy) / n))) * 180) / Math.PI
    return { lon, lat }
  }
  function lonLatToPx(lon, lat) {
    const latRad = (lat * Math.PI) / 180
    const gx = ((lon + 180) / 360) * n
    const gy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    return { px: (gx - originX) * TILE_PX, py: (gy - originY) * TILE_PX }
  }
  return { dem, worldToPx, pxToWorld, pxToLonLat, lonLatToPx }
}

export function lonLatToWorld(geo, lon, lat) {
  const { px, py } = geo.lonLatToPx(lon, lat)
  return geo.pxToWorld(px, py)
}

export function worldToLonLat(geo, x, z) {
  const { px, py } = geo.worldToPx(x, z)
  return geo.pxToLonLat(px, py)
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180
  const dLat = (lat2 - lat1) * r
  const dLon = (lon2 - lon1) * r
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(a))
}
```

**Step 4: Run test to verify pass**

Run: `npx vitest run src/lib/geo.test.js`
Expected: 5 passed

**Step 5: Commit**

```bash
git add src/lib/geo.js src/lib/geo.test.js
git commit -m "feat(geo): WGS-84 ↔ world coordinate conversion"
```

**Acceptance:** `npx vitest run src/lib/geo.test.js` → 5 passed(含 round-trip 1e-6° 精度)
**Covers:** R8
**Execution:** serial

---

### Task 3: 线路模型 `route.js`

**Objective:** 途经点管理 + Catmull-Rom 样条采样 + 贴地/高程/里程统计,纯函数。

**Files:**
- Create: `src/lib/route.js`
- Test: `src/lib/route.test.js`
- Depends: Task 2(`geo.js`)

**Step 1: Write failing test**

Create `src/lib/route.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { makeGeoContext, lonLatToWorld } from './geo.js'
import {
  createRoute, addWaypoint, removeWaypoint, moveWaypoint,
  sampleRoutePath, routeStats, MAX_WAYPOINTS,
} from './route.js'

const dem = { lat: 36.998, lon: -110.0984, zoom: 12, size: 768 }
const geo = makeGeoContext(dem)
// flat fake elevation sampler: world (x,z) → meters
const flatElev = () => 1000

describe('route model', () => {
  it('addWaypoint appends with elevation and auto name; enforces cap', () => {
    const r = createRoute('t')
    for (let i = 0; i < MAX_WAYPOINTS; i++) addWaypoint(r, -110 + i * 0.001, 37, 900 + i)
    expect(r.waypoints).toHaveLength(MAX_WAYPOINTS)
    expect(r.waypoints[0].name).toBe('P1')
    expect(addWaypoint(r, -109, 37, 900)).toBeNull() // over cap
  })

  it('removeWaypoint / moveWaypoint', () => {
    const r = createRoute('t')
    addWaypoint(r, -110.1, 37, 900)
    addWaypoint(r, -110.0, 37, 950)
    addWaypoint(r, -109.9, 37, 920)
    moveWaypoint(r, 0, 2)
    expect(r.waypoints[2].elev).toBe(900)
    removeWaypoint(r, 1)
    expect(r.waypoints.map((w) => w.elev)).toEqual([950, 900])
  })

  it('sampleRoutePath returns arc-length-parameterized points with elevation', () => {
    const r = createRoute('t')
    addWaypoint(r, -110.1, 37.0, 900)
    addWaypoint(r, -110.0, 37.0, 950)
    addWaypoint(r, -109.9, 37.01, 920)
    const pts = sampleRoutePath(geo, r.waypoints, flatElev, 120)
    expect(pts.length).toBe(120)
    // each point carries world + lonLat + elevation
    expect(pts[0].lon).toBeCloseTo(-110.1, 5)
    expect(pts.at(-1).lon).toBeCloseTo(-109.9, 5)
    expect(pts[0].ele).toBe(1000)
    // cumulative distance strictly increasing
    for (let i = 1; i < pts.length; i++) expect(pts[i].cumDistM).toBeGreaterThan(pts[i - 1].cumDistM)
  })

  it('routeStats: distance / ascent / descent / heuristic drive time', () => {
    const pts = [
      { lon: -110.1, lat: 37, ele: 1000, cumDistM: 0 },
      { lon: -110.0, lat: 37, ele: 1200, cumDistM: 8900 },
      { lon: -109.9, lat: 37, ele: 1100, cumDistM: 17800 },
    ]
    const s = routeStats(pts)
    expect(s.distanceM).toBeCloseTo(17800, 0)
    expect(s.ascentM).toBe(200)
    expect(s.descentM).toBe(100)
    expect(s.maxEle).toBe(1200)
    expect(s.driveMinutes).toBeGreaterThan(0)
  })

  it('sampleRoutePath with <2 waypoints returns []', () => {
    expect(sampleRoutePath(geo, [], flatElev, 120)).toEqual([])
    expect(sampleRoutePath(geo, [{ lon: 0, lat: 0 }], flatElev, 120)).toEqual([])
  })
})
```

**Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/route.test.js`
Expected: FAIL — `Cannot find module './route.js'`

**Step 3: Write implementation**

Create `src/lib/route.js`:

```js
// Route model: waypoints + Catmull-Rom path sampling + stats. Pure module.
import { lonLatToWorld, worldToLonLat, haversineMeters } from './geo.js'

export const MAX_WAYPOINTS = 32
export const DEFAULT_SAMPLES = 240

export function createRoute(name = '未命名线路') {
  return { id: crypto.randomUUID(), name, createdAt: Date.now(), waypoints: [] }
}

export function addWaypoint(route, lon, lat, ele, name) {
  if (route.waypoints.length >= MAX_WAYPOINTS) return null
  const wp = { id: crypto.randomUUID(), lon, lat, ele, name: name ?? `P${route.waypoints.length + 1}` }
  route.waypoints.push(wp)
  return wp
}

export function removeWaypoint(route, index) {
  route.waypoints.splice(index, 1)
}

export function moveWaypoint(route, from, to) {
  const [wp] = route.waypoints.splice(from, 1)
  route.waypoints.splice(to, 0, wp)
}

// Catmull-Rom (uniform) over world-space control points; sampled by arc length.
// elevOf: (x, z) => meters — injected so tests can use fakes; production passes
// a closure over sampleDem() with exaggeration handled by the render layer.
export function sampleRoutePath(geo, waypoints, elevOf, nSamples = DEFAULT_SAMPLES) {
  if (waypoints.length < 2) return []
  const cps = waypoints.map((w) => {
    const { x, z } = lonLatToWorld(geo, w.lon, w.lat)
    return { x, z }
  })
  // dense polyline through Catmull-Rom segments (32 sub-steps per span)
  const dense = []
  const SUB = 32
  const cr = (p0, p1, p2, p3, t) =>
    0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)
  const pad = [cps[0], ...cps, cps[cps.length - 1]]
  for (let i = 0; i < pad.length - 3; i++) {
    for (let j = 0; j < SUB; j++) {
      const t = j / SUB
      dense.push({
        x: cr(pad[i].x, pad[i + 1].x, pad[i + 2].x, pad[i + 3].x, t),
        z: cr(pad[i].z, pad[i + 1].z, pad[i + 2].z, pad[i + 3].z, t),
      })
    }
  }
  dense.push(pad[pad.length - 2])

  // arc-length resample to nSamples, attaching lonLat + elevation + cumDistM
  const cum = [0]
  for (let i = 1; i < dense.length; i++) {
    const a = worldToLonLat(geo, dense[i - 1].x, dense[i - 1].z)
    const b = worldToLonLat(geo, dense[i].x, dense[i].z)
    cum.push(cum[i - 1] + haversineMeters(a.lat, a.lon, b.lat, b.lon))
  }
  const total = cum[cum.length - 1]
  const out = []
  let k = 0
  for (let i = 0; i < nSamples; i++) {
    const target = (i / (nSamples - 1)) * total
    while (k < cum.length - 2 && cum[k + 1] < target) k++
    const span = cum[k + 1] - cum[k] || 1
    const f = (target - cum[k]) / span
    const x = dense[k].x + (dense[k + 1].x - dense[k].x) * f
    const z = dense[k].z + (dense[k + 1].z - dense[k].z) * f
    const { lon, lat } = worldToLonLat(geo, x, z)
    out.push({ x, z, lon, lat, ele: elevOf(x, z), cumDistM: target })
  }
  return out
}

// Heuristic drive time (示意): 40 km/h flat baseline + 10 min per 300 m ascent.
export function routeStats(pts) {
  if (!pts.length) return { distanceM: 0, ascentM: 0, descentM: 0, maxEle: 0, minEle: 0, driveMinutes: 0 }
  let ascent = 0, descent = 0, maxEle = -Infinity, minEle = Infinity
  for (let i = 0; i < pts.length; i++) {
    maxEle = Math.max(maxEle, pts[i].ele)
    minEle = Math.min(minEle, pts[i].ele)
    if (i > 0) {
      const d = pts[i].ele - pts[i - 1].ele
      if (d > 0) ascent += d
      else descent -= d
    }
  }
  const distanceM = pts[pts.length - 1].cumDistM
  const driveMinutes = Math.round(distanceM / 1000 / 40 * 60 + (ascent / 300) * 10)
  return { distanceM, ascentM: Math.round(ascent), descentM: Math.round(descent), maxEle: Math.round(maxEle), minEle: Math.round(minEle), driveMinutes }
}
```

**Step 4: Run test to verify pass**

Run: `npx vitest run src/lib/route.test.js`
Expected: 5 passed

**Step 5: Commit**

```bash
git add src/lib/route.js src/lib/route.test.js
git commit -m "feat(route): waypoint model + spline sampling + stats"
```

**Acceptance:** `npx vitest run src/lib/route.test.js` → 5 passed
**Covers:** R1(数据面)、R2(采样)、R3(统计)
**Execution:** serial

---

### Task 4: provider 接口骨架(R9)

**Objective:** 定义 RoutingProvider / WeatherProvider 接口与 NotImplemented 存根,锁定 P4 扩展点。

**Files:**
- Create: `src/providers/routing.js`
- Create: `src/providers/weather.js`
- Test: `src/providers/providers.test.js`

**Step 1: Write failing test**

Create `src/providers/providers.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createRoutingProvider } from './routing.js'
import { createWeatherProvider } from './weather.js'

describe('provider skeletons', () => {
  it('routing stub throws NotImplemented with provider name', async () => {
    const p = createRoutingProvider('none')
    await expect(p.plan([])).rejects.toThrow(/NotImplemented.*routing/)
  })
  it('weather stub throws NotImplemented with provider name', async () => {
    const p = createWeatherProvider('none')
    await expect(p.daily({ lon: 0, lat: 0 }, '2026-09-01', '2026-09-03')).rejects.toThrow(/NotImplemented.*weather/)
  })
  it('unknown provider kind throws at factory', () => {
    expect(() => createRoutingProvider('amap')).toThrow(/unknown routing provider/)
    expect(() => createWeatherProvider('open-meteo')).toThrow(/unknown weather provider/)
  })
})
```

**Step 2: Run test to verify failure**

Run: `npx vitest run src/providers/providers.test.js`
Expected: FAIL — modules missing

**Step 3: Write implementation**

Create `src/providers/routing.js`:

```js
// RoutingProvider — P4 extension point (road-network snapping).
// MVP ships no implementation; 'none' is the only registered kind.
//
// @typedef {{ lon: number, lat: number }} LonLat
// @typedef {{ distanceM: number, durationS: number, geometry: LonLat[] }} RouteLeg
// Interface: plan(waypoints: LonLat[], opts?: { mode?: 'driving' }) => Promise<RouteLeg[]>

class StubRoutingProvider {
  constructor(kind) { this.kind = kind }
  // eslint-disable-next-line no-unused-vars
  async plan(waypoints, opts = {}) {
    throw new Error(`NotImplemented: routing provider '${this.kind}' (reserved for P4)`)
  }
}

const KINDS = { none: StubRoutingProvider }

export function createRoutingProvider(kind) {
  const Klass = KINDS[kind]
  if (!Klass) throw new Error(`unknown routing provider: ${kind}`)
  return new Klass(kind)
}
```

Create `src/providers/weather.js`:

```js
// WeatherProvider — P2 extension point (Open-Meteo first, Caiyun/QWeather later).
// MVP ships no implementation; 'none' is the only registered kind.
//
// @typedef {{ date: string, precipMm: number, weatherCode: number }} WeatherDay
// Interface: daily(point: { lon, lat }, fromISO: string, toISO: string) => Promise<WeatherDay[]>

class StubWeatherProvider {
  constructor(kind) { this.kind = kind }
  // eslint-disable-next-line no-unused-vars
  async daily(point, fromISO, toISO) {
    throw new Error(`NotImplemented: weather provider '${this.kind}' (reserved for P2)`)
  }
}

const KINDS = { none: StubWeatherProvider }

export function createWeatherProvider(kind) {
  const Klass = KINDS[kind]
  if (!Klass) throw new Error(`unknown weather provider: ${kind}`)
  return new Klass(kind)
}
```

**Step 4: Run test to verify pass**

Run: `npx vitest run src/providers/providers.test.js`
Expected: 3 passed

**Step 5: Commit**

```bash
git add src/providers/
git commit -m "feat(providers): routing/weather interface skeletons (P2/P4 extension points)"
```

**Acceptance:** `npx vitest run src/providers/providers.test.js` → 3 passed
**Covers:** R9
**Execution:** serial


## P1 — 持久化与 three.js 集成

### Task 5: IndexedDB 线路库 `store.js`(R5)

**Objective:** routes 表的 CRUD + 序列化;用 fake-indexeddb 做单测。

**Files:**
- Create: `src/lib/store.js`
- Test: `src/lib/store.test.js`

**Step 1: Write failing test**

Create `src/lib/store.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openRouteStore, serializeRoute, hydrateRoute } from './store.js'
import { createRoute, addWaypoint } from './route.js'

describe('route store', () => {
  let store
  beforeEach(async () => {
    indexedDB.deleteDatabase('trip3d')
    store = await openRouteStore('trip3d')
  })

  it('serialize/hydrate round-trip strips runtime fields only', () => {
    const r = createRoute('四姑娘山 D3')
    addWaypoint(r, 102.83, 31.05, 3850)
    addWaypoint(r, 102.9, 31.02, 4100, '垭口')
    const h = hydrateRoute(serializeRoute(r))
    expect(h.name).toBe('四姑娘山 D3')
    expect(h.waypoints).toHaveLength(2)
    expect(h.waypoints[1].name).toBe('垭口')
    expect(h.waypoints[1].ele).toBe(4100)
  })

  it('save / list / load / delete', async () => {
    const r = createRoute('A')
    addWaypoint(r, 102.8, 31.0, 3800)
    await store.save(r)
    const r2 = createRoute('B')
    await store.save(r2)
    const list = await store.list()
    expect(list.map((x) => x.name).sort()).toEqual(['A', 'B'])
    const loaded = await store.load(r.id)
    expect(loaded.name).toBe('A')
    expect(loaded.waypoints).toHaveLength(1)
    await store.remove(r.id)
    expect((await store.list()).map((x) => x.name)).toEqual(['B'])
  })

  it('list returns summary without full waypoint payloads sorted by updatedAt desc', async () => {
    const a = createRoute('old')
    await store.save(a)
    await new Promise((r) => setTimeout(r, 5))
    const b = createRoute('new')
    await store.save(b)
    const list = await store.list()
    expect(list[0].name).toBe('new')
    expect(list[0].waypointCount).toBe(0)
    expect(list[0].waypoints).toBeUndefined()
  })
})
```

**Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/store.test.js`
Expected: FAIL — module missing

**Step 3: Write implementation**

Create `src/lib/store.js`:

```js
// Route persistence: IndexedDB CRUD + (de)serialization.
const DB_VERSION = 1
const STORE = 'routes'

export function serializeRoute(route) {
  return {
    id: route.id,
    name: route.name,
    createdAt: route.createdAt,
    updatedAt: Date.now(),
    waypoints: route.waypoints.map(({ lon, lat, ele, name }) => ({ lon, lat, ele, name })),
  }
}

export function hydrateRoute(rec) {
  return {
    id: rec.id,
    name: rec.name,
    createdAt: rec.createdAt,
    waypoints: (rec.waypoints ?? []).map((w, i) => ({
      id: crypto.randomUUID(),
      lon: w.lon, lat: w.lat, ele: w.ele, name: w.name ?? `P${i + 1}`,
    })),
  }
}

export function openRouteStore(dbName = 'trip3d') {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = (mode, fn) =>
        new Promise((res, rej) => {
          const t = db.transaction(STORE, mode)
          const out = fn(t.objectStore(STORE))
          t.oncomplete = () => res(out?.result ?? out)
          t.onerror = () => rej(t.error)
        })
      resolve({
        save: (route) => tx('readwrite', (s) => s.put(serializeRoute(route))),
        load: (id) =>
          new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readonly')
            const q = t.objectStore(STORE).get(id)
            q.onsuccess = () => (q.result ? res(hydrateRoute(q.result)) : res(null))
            q.onerror = () => rej(q.error)
          }),
        list: () =>
          new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readonly')
            const q = t.objectStore(STORE).getAll()
            q.onsuccess = () => {
              const items = q.result
                .map(({ id, name, updatedAt, waypoints }) => ({
                  id, name, updatedAt, waypointCount: waypoints?.length ?? 0,
                }))
                .sort((a, b) => b.updatedAt - a.updatedAt)
              res(items)
            }
            q.onerror = () => rej(q.error)
          }),
        remove: (id) => tx('readwrite', (s) => s.delete(id)),
      })
    }
  })
}
```

**Step 4: Run test to verify pass**

Run: `npx vitest run src/lib/store.test.js`
Expected: 3 passed

**Step 5: Commit**

```bash
git add src/lib/store.js src/lib/store.test.js
git commit -m "feat(store): IndexedDB route library CRUD"
```

**Acceptance:** `npx vitest run src/lib/store.test.js` → 3 passed
**Covers:** R5
**Execution:** serial

---

### Task 6: GPX 导入导出 `gpx.js`(R6)

**Objective:** GPX 1.1 `<rte>` 导出为文件字符串;解析 GPX(`rtept`,兼容命名空间)回线路。

**Files:**
- Create: `src/lib/gpx.js`
- Test: `src/lib/gpx.test.js`
- Depends: Task 3(`route.js`)

**Step 1: Write failing test**

Create `src/lib/gpx.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { routeToGpx, gpxToRoute } from './gpx.js'
import { createRoute, addWaypoint } from './route.js'

const sample = () => {
  const r = createRoute('四姑娘山 D3')
  addWaypoint(r, 102.83, 31.05, 3850)
  addWaypoint(r, 102.9, 31.02, 4100, '垭口')
  return r
}

describe('gpx', () => {
  it('exports valid GPX 1.1 with rte/rtept', () => {
    const g = routeToGpx(sample())
    expect(g).toContain('<gpx version="1.1"')
    expect(g).toContain('<rte>')
    expect(g).toContain('lat="31.05"')
    expect(g).toContain('<ele>3850</ele>')
    expect(g).toContain('<name>垭口</name>')
  })

  it('escapes XML entities in names', () => {
    const r = createRoute('A & B <trail>')
    addWaypoint(r, 1, 2, 3, 'P<1>')
    const g = routeToGpx(r)
    expect(g).toContain('A &amp; B &lt;trail&gt;')
    expect(g).toContain('P&lt;1&gt;')
  })

  it('round-trip: gpxToRoute(routeToGpx(r)) preserves waypoints', () => {
    const r = sample()
    const back = gpxToRoute(routeToGpx(r))
    expect(back.name).toBe('四姑娘山 D3')
    expect(back.waypoints).toHaveLength(2)
    expect(back.waypoints[0].lon).toBeCloseTo(102.83, 6)
    expect(back.waypoints[1].ele).toBe(4100)
    expect(back.waypoints[1].name).toBe('垭口')
  })

  it('parses namespaced GPX and wpt-only files', () => {
    const g = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="x">
  <wpt lat="31.05" lon="102.83"><ele>3850</ele><name>Summit</name></wpt>
</gpx>`
    const r = gpxToRoute(g)
    expect(r.waypoints).toHaveLength(1)
    expect(r.waypoints[0].name).toBe('Summit')
  })

  it('throws on empty/invalid GPX', () => {
    expect(() => gpxToRoute('<gpx></gpx>')).toThrow(/no waypoints/i)
    expect(() => gpxToRoute('not xml')).toThrow(/invalid/i)
  })
})
```

**Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/gpx.test.js`
Expected: FAIL — module missing

**Step 3: Write implementation**

Create `src/lib/gpx.js`:

```js
// GPX 1.1 import/export. Export is string-built; import uses DOMParser (browser/jsdom).
import { createRoute, addWaypoint } from './route.js'

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function routeToGpx(route) {
  const pts = route.waypoints
    .map(
      (w) =>
        `    <rtept lat="${w.lat}" lon="${w.lon}"><ele>${w.ele}</ele><name>${esc(w.name)}</name></rtept>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="trip-3d" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>${esc(route.name)}</name>
${pts}
  </rte>
</gpx>
`
}

export function gpxToRoute(xmlText) {
  let doc
  try {
    doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  } catch {
    throw new Error('invalid GPX: not XML')
  }
  if (doc.querySelector('parsererror')) throw new Error('invalid GPX: parse error')

  const named = (el) => {
    const n = el.getElementsByTagName('name')[0]
    return n ? n.textContent.trim() : undefined
  }
  const toWp = (el, i) => ({
    lon: parseFloat(el.getAttribute('lon')),
    lat: parseFloat(el.getAttribute('lat')),
    ele: parseFloat(el.getElementsByTagName('ele')[0]?.textContent ?? '0'),
    name: named(el) ?? `P${i + 1}`,
  })

  // namespace-tolerant: getElementsByTagName works on no-ns docs; *NS covers real GPX
  const pick = (tag) => {
    const els = [...doc.getElementsByTagName(tag)]
    return els.length ? els : [...doc.getElementsByTagNameNS('*', tag)]
  }
  let els = pick('rtept')
  if (!els.length) els = pick('wpt')
  if (!els.length) els = pick('trkpt')
  if (!els.length) throw new Error('no waypoints in GPX')

  const routeName =
    named(pick('rte')[0] ?? doc.documentElement) ?? doc.documentElement.getAttribute('creator') ?? '导入线路'
  const route = createRoute(routeName)
  els.forEach((el, i) => {
    const w = toWp(el, i)
    addWaypoint(route, w.lon, w.lat, w.ele, w.name)
  })
  return route
}
```

**Step 4: Run test to verify pass**

Run: `npx vitest run src/lib/gpx.test.js`
Expected: 5 passed

**Step 5: Commit**

```bash
git add src/lib/gpx.js src/lib/gpx.test.js
git commit -m "feat(gpx): GPX 1.1 import/export"
```

**Acceptance:** `npx vitest run src/lib/gpx.test.js` → 5 passed
**Covers:** R6
**Execution:** serial

---

### Task 7: URL 分享编解码 `share.js`(R7)

**Objective:** 线路+地形上下文 ↔ base64url JSON hash,打开链接复原。

**Files:**
- Create: `src/lib/share.js`
- Test: `src/lib/share.test.js`
- Depends: Task 3

**Step 1: Write failing test**

Create `src/lib/share.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare } from './share.js'
import { createRoute, addWaypoint } from './route.js'

const ctx = { dem: { lat: 31.05, lon: 102.83, zoom: 12 } }

describe('share codec', () => {
  it('round-trips route + dem context', () => {
    const r = createRoute('四姑娘山')
    addWaypoint(r, 102.83, 31.05, 3850)
    addWaypoint(r, 102.9, 31.02, 4100, '垭口')
    const hash = encodeShare(r, ctx)
    const back = decodeShare(hash)
    expect(back.dem).toEqual(ctx.dem)
    expect(back.name).toBe('四姑娘山')
    expect(back.waypoints).toHaveLength(2)
    expect(back.waypoints[1]).toMatchObject({ lon: 102.9, lat: 31.02, ele: 4100, name: '垭口' })
  })

  it('produces URL-safe base64url without padding', () => {
    const r = createRoute('x')
    addWaypoint(r, 1, 2, 3)
    const hash = encodeShare(r, ctx)
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rejects malformed payloads', () => {
    expect(() => decodeShare('!!!')).toThrow()
    expect(() => decodeShare(btoa('{"v":99}')).toThrow(/version/))
    expect(() => decodeShare(btoa('{"v":1}')).toThrow(/dem|waypoints/i))
  })
})
```

**Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/share.test.js`
Expected: FAIL — module missing

**Step 3: Write implementation**

Create `src/lib/share.js`:

```js
// URL-hash share codec: { v, dem:{lat,lon,zoom}, name, waypoints } ↔ base64url.
const VERSION = 1

const b64urlEncode = (obj) => {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const b64urlDecode = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function encodeShare(route, ctx) {
  return b64urlEncode({
    v: VERSION,
    dem: { lat: ctx.dem.lat, lon: ctx.dem.lon, zoom: ctx.dem.zoom },
    name: route.name,
    waypoints: route.waypoints.map(({ lon, lat, ele, name }) => [lon, lat, ele, name]),
  })
}

export function decodeShare(hash) {
  const obj = b64urlDecode(hash)
  if (obj.v !== VERSION) throw new Error(`unsupported share version: ${obj.v}`)
  if (!obj.dem || typeof obj.dem.lat !== 'number' || !Array.isArray(obj.waypoints))
    throw new Error('invalid share payload: dem/waypoints missing')
  return {
    dem: obj.dem,
    name: obj.name ?? '分享线路',
    waypoints: obj.waypoints.map(([lon, lat, ele, name]) => ({ lon, lat, ele, name })),
  }
}
```

**Step 4: Run test to verify pass**

Run: `npx vitest run src/lib/share.test.js`
Expected: 3 passed(node 18+ 自带 atob/btoa)

**Step 5: Commit**

```bash
git add src/lib/share.js src/lib/share.test.js
git commit -m "feat(share): URL-hash share codec"
```

**Acceptance:** `npx vitest run src/lib/share.test.js` → 3 passed
**Covers:** R7(编解码面)
**Execution:** serial

---

### Task 8: 渲染层 `RouteLayer.js`(R1/R2 视觉面)

**Objective:** three.js group:序号 marker + 贴地样条线;随线路变更重建。薄胶水层,人工验收。

**Files:**
- Create: `src/route/RouteLayer.js`
- Depends: Task 2/3;`src/terrain.js`(TERRAIN_SIZE, sample)

**Step 1: 实现**

Create `src/route/RouteLayer.js`:

```js
// RouteLayer: waypoint markers (numbered sprites) + terrain-draped route line.
// Thin three.js glue over src/lib pure modules — verified manually in dev server.
import * as THREE from 'three'
import { lonLatToWorld } from '../lib/geo.js'
import { sampleRoutePath } from '../lib/route.js'

const LINE_LIFT = 0.09 // world units above surface to avoid z-fighting
const MARKER_R = 0.28

function makeNumberSprite(n, accent = '#ff4d00') {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(64, 64, 56, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 64px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), 64, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
  sp.scale.setScalar(1.6)
  return sp
}

export class RouteLayer {
  // sceneSample: terrain.sample (world → scene height); elevOf: world → real meters
  constructor(geo, sceneSample, elevOf, exaggerationScale) {
    this.geo = geo
    this.sceneSample = sceneSample
    this.elevOf = elevOf
    this.group = new THREE.Group()
    this.group.renderOrder = 10
    this._line = null
    this._markers = []
  }

  _clear() {
    for (const m of this._markers) {
      m.material.map.dispose()
      m.material.dispose()
      this.group.remove(m)
    }
    this._markers = []
    if (this._line) {
      this._line.geometry.dispose()
      this._line.material.dispose()
      this.group.remove(this._line)
      this._line = null
    }
  }

  update(waypoints) {
    this._clear()
    // markers at waypoint positions, sitting on the surface
    waypoints.forEach((w, i) => {
      const { x, z } = lonLatToWorld(this.geo, w.lon, w.lat)
      const sp = makeNumberSprite(i + 1)
      sp.position.set(x, this.sceneSample(x, z) + MARKER_R + 0.5, z)
      this._markers.push(sp)
      this.group.add(sp)
    })
    // draped line through arc-length samples
    if (waypoints.length >= 2) {
      const pts = sampleRoutePath(this.geo, waypoints, this.elevOf)
      const verts = new Float32Array(pts.length * 3)
      pts.forEach((p, i) => {
        verts[i * 3] = p.x
        verts[i * 3 + 1] = this.sceneSample(p.x, p.z) + LINE_LIFT
        verts[i * 3 + 2] = p.z
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
      this._line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ff4d00' }))
      this.group.add(this._line)
    }
    return pts(waypoints)
  }
}

// exposed for main.js: also return sampled pts for profile/stats panels
function pts(waypoints) {
  return waypoints.length >= 2 ? RouteLayer._lastPts : []
}
```

⚠️ 上面 `pts()` 是占位败笔 —— 实现时改为:`update()` 返回 `sampleRoutePath` 的结果(无缓存函数),删除 `pts()`:

```js
  update(waypoints) {
    this._clear()
    waypoints.forEach(/* …同上… */)
    if (waypoints.length < 2) return []
    const pts = sampleRoutePath(this.geo, waypoints, this.elevOf)
    // …build line…
    return pts
  }
```

**Step 2: 人工验收**

Run: `npm run dev` → 浏览器开 `http://localhost:5173`,Terrain source 选 real world,加载后由 Task 9 的集成代码打点。
Expected(Task 9 完成后):marker 显示序号、线条贴地不穿模、缩放/旋转不漂移。

**Step 3: Commit**

```bash
git add src/route/RouteLayer.js
git commit -m "feat(route-layer): numbered markers + terrain-draped spline"
```

**Acceptance:** `npm run build` → exit 0;dev 下目视 marker/贴地线正常(Task 9 集成后)
**Covers:** R1(视觉)、R2(视觉)
**Execution:** serial

---

### Task 9: 主程序集成 `main.js`(R1/R7 交互面)

**Objective:** 规划模式开关、点击落点(raycast)、GUI「线路规划」文件夹、启动时读 URL hash 复原。

**Files:**
- Modify: `src/main.js`(新增约 120 行集成代码 + GUI folder)
- Depends: Task 2/3/5/6/7/8

**Step 1: 实现(插入点与代码)**

a) 顶部 import(L25 `loadDem` 之后):

```js
import { makeGeoContext, worldToLonLat } from './lib/geo.js'
import { createRoute, addWaypoint, routeStats } from './lib/route.js'
import { RouteLayer } from './route/RouteLayer.js'
import { openRouteStore, serializeRoute } from './lib/store.js'
import { routeToGpx, gpxToRoute } from './lib/gpx.js'
import { encodeShare, decodeShare } from './lib/share.js'
import { sampleDem } from './dem.js'
```

b) params 增加(L48 `demExaggeration` 后):`planning: false, routeName: '未命名线路',`

c) 线路状态与重建函数(放在 `regenerateTerrain()` 定义之后):

```js
// ------------------------------------------------------------------ route planning
let geo = null // makeGeoContext(dem), set in loadRealTerrain
let route = createRoute()
let routeLayer = null
let routeStore = null
openRouteStore().then((s) => (routeStore = s)).catch((e) => console.warn('IDB unavailable', e))

function elevOfWorld(x, z) {
  const { px, py } = geo.worldToPx(x, z)
  return sampleDem(dem, px, py) // real meters (un-exaggerated)
}

function refreshRoute() {
  if (!routeLayer) return
  const pts = routeLayer.update(route.waypoints)
  updateRouteHud(route, pts.length ? routeStats(pts) : null, pts)
}

function ensureRouteLayer() {
  if (routeLayer || !geo || !dem) return
  routeLayer = new RouteLayer(geo, terrain.sample, elevOfWorld, params.demExaggeration)
  scene.add(routeLayer.group)
}
```

d) `loadRealTerrain()` 内 `terrain.setDem(dem)` 之后加:

```js
geo = makeGeoContext(dem)
ensureRouteLayer()
refreshRoute()
```

e) 点击落点(pointer 段 L566 之后;click 与 orbit 拖拽区分:位移 < 6px 才算点击):

```js
const raycaster = new THREE.Raycaster()
let downPos = null
window.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY }
})
window.addEventListener('pointerup', (e) => {
  if (!params.planning || !downPos || !geo || !dem) return
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
  raycaster.setFromCamera(ndc, camera)
  const hit = raycaster.intersectObject(terrain.mesh, false)[0]
  if (!hit) return
  const { lon, lat } = worldToLonLat(geo, hit.point.x, hit.point.z)
  const wp = addWaypoint(route, lon, lat, Math.round(elevOfWorld(hit.point.x, hit.point.z)))
  if (!wp) return console.warn('waypoint cap reached')
  refreshRoute()
})
```

f) GUI folder(GUI 段,`fSource` 之后):

```js
const fRoute = gui.addFolder('线路规划 Route')
fRoute.add(params, 'planning').name('规划模式(点击落点)').onChange((v) => {
  if (v && !dem) loadRealTerrain()
  ensureRouteLayer()
})
fRoute.add(params, 'routeName').name('线路名').onFinishChange((v) => { route.name = v; refreshRoute() })
fRoute.add({ undo: () => { route.waypoints.pop(); refreshRoute() } }, 'undo').name('撤销末点')
fRoute.add({ clear: () => { route.waypoints = []; refreshRoute() } }, 'clear').name('清空')
fRoute.add({ save: async () => { route.name = params.routeName; await routeStore?.save(route); refreshLibrary() } }, 'save').name('保存到线路库')
fRoute.add({
  share: async () => {
    const hash = encodeShare(route, { dem })
    const url = `${location.origin}${location.pathname}#r=${hash}`
    await navigator.clipboard.writeText(url)
    history.replaceState(null, '', `#r=${hash}`)
  },
}, 'share').name('复制分享链接')
fRoute.add({
  exportGpx: () => {
    const blob = new Blob([routeToGpx(route)], { type: 'application/gpx+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${route.name || 'route'}.gpx`
    a.click()
    URL.revokeObjectURL(a.href)
  },
}, 'exportGpx').name('导出 GPX')
fRoute.add({
  importGpx: () => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.gpx'
    inp.onchange = async () => {
      try {
        route = gpxToRoute(await inp.files[0].text())
        params.routeName = route.name
        ensureRouteLayer()
        refreshRoute()
        gui.controllersRecursive().forEach((c) => c.updateDisplay())
      } catch (err) { alert(`GPX 导入失败: ${err.message}`) }
    }
    inp.click()
  },
}, 'importGpx').name('导入 GPX')
```

g) 启动时 hash 复原(文件末尾 resize listener 之前):

```js
// restore shared route from URL hash (#r=...)
if (location.hash.startsWith('#r=')) {
  try {
    const shared = decodeShare(location.hash.slice(3))
    params.demLat = shared.dem.lat
    params.demLon = shared.dem.lon
    params.demZoom = shared.dem.zoom
    route = createRoute(shared.name)
    params.routeName = shared.name
    for (const w of shared.waypoints) addWaypoint(route, w.lon, w.lat, w.ele, w.name)
    params.planning = true
    loadRealTerrain()
  } catch (err) { console.warn('bad share hash', err) }
}
```

h) `updateRouteHud` / `refreshLibrary` 在 Task 10 实现;此处先加前向声明占位(Task 9 内允许 `function updateRouteHud(){}` 空函数 + `function refreshLibrary(){}`,Task 10 替换)。

**Step 2: 验证**

Run: `npm run build`
Expected: exit 0
Run: `npm run dev` 人工:开规划模式 → 点击地形 → marker 出现、连线;「复制分享链接」后新开标签粘贴 → 地形与线路复原。

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat(main): planning mode, click-to-place waypoints, route GUI, hash restore"
```

**Acceptance:** `npm run build` → exit 0;人工:打点/撤销/清空/分享链接复原全部可用
**Covers:** R1(交互)、R7(URL 复原)
**Execution:** serial

---

### Task 10: 高程剖面 + 线路库面板(R3/R4/R5 UI)

**Objective:** 底部剖面 canvas(折线+统计文本)与线路库下拉列表,HUD 风格复用现有 hud2d 样式。

**Files:**
- Create: `src/route/RouteHud.js`
- Modify: `src/main.js`(替换 Task 9 的两个空函数)
- Modify: `index.html`(加容器 div)
- Depends: Task 9

**Step 1: 实现**

Create `src/route/RouteHud.js`:

```js
// Bottom elevation-profile panel + route stats line + library list. DOM/canvas, no three.
export class RouteHud {
  constructor(accent = '#ff4d00') {
    this.accent = accent
    this.el = document.createElement('div')
    this.el.className = 'route-hud'
    this.el.innerHTML = `
      <div class="route-stats">打点开始规划线路</div>
      <canvas class="route-profile" width="560" height="120"></canvas>
      <div class="route-library"><select><option value="">线路库…</option></select>
        <button data-act="load">加载</button><button data-act="del">删除</button></div>`
    this.el.querySelector('[data-act=load]').onclick = () => this.onLoad?.(this.el.querySelector('select').value)
    this.el.querySelector('[data-act=del]').onclick = () => this.onDelete?.(this.el.querySelector('select').value)
    document.body.appendChild(this.el)
    this.canvas = this.el.querySelector('canvas')
    this.statsEl = this.el.querySelector('.route-stats')
    this.select = this.el.querySelector('select')
  }

  setStats(route, stats) {
    if (!stats || !route.waypoints.length) {
      this.statsEl.textContent = route.waypoints.length ? `${route.name} · ${route.waypoints.length} 点` : '打点开始规划线路'
      this._draw([])
      return
    }
    const km = (stats.distanceM / 1000).toFixed(1)
    this.statsEl.textContent =
      `${route.name} · ${route.waypoints.length} 点 · ${km} km · ↑${stats.ascentM}m ↓${stats.descentM}m` +
      ` · 最高 ${stats.maxEle}m · 示意车程 ${Math.floor(stats.driveMinutes / 60)}h${stats.driveMinutes % 60}m`
  }

  drawProfile(pts) { this._draw(pts) }

  _draw(pts) {
    const ctx = this.canvas.getContext('2d')
    const { width: W, height: H } = this.canvas
    ctx.clearRect(0, 0, W, H)
    if (!pts.length) return
    const eles = pts.map((p) => p.ele)
    const min = Math.min(...eles), max = Math.max(...eles), span = Math.max(max - min, 1)
    ctx.strokeStyle = this.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    pts.forEach((p, i) => {
      const x = (i / (pts.length - 1)) * (W - 20) + 10
      const y = H - 18 - ((p.ele - min) / span) * (H - 40)
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.stroke()
    ctx.fillStyle = '#17191b'
    ctx.font = '12px monospace'
    ctx.fillText(`${max} m`, 10, 14)
    ctx.fillText(`${min} m`, 10, H - 6)
  }

  setLibrary(items) {
    this.select.innerHTML = '<option value="">线路库…</option>' +
      items.map((i) => `<option value="${i.id}">${i.name} (${i.waypointCount}点)</option>`).join('')
  }
}
```

`index.html` `<body>` 内 `#app` 后无改动需求(RouteHud 自行 append);`src/style.css` 追加:

```css
.route-hud {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
  background: rgba(255,255,255,0.82); backdrop-filter: blur(9px);
  border: 1px solid rgba(23,25,27,0.25); padding: 8px 12px; font: 13px/1.6 monospace;
  color: #17191b; z-index: 20; min-width: 580px;
}
.route-profile { display: block; width: 560px; height: 120px; }
.route-library { display: flex; gap: 6px; }
```

`main.js` 替换占位函数:

```js
const routeHud = new RouteHud(params.hudAccent)
function updateRouteHud(route, stats, pts) {
  routeHud.setStats(route, stats)
  routeHud.drawProfile(pts ?? [])
}
async function refreshLibrary() {
  if (!routeStore) return
  routeHud.setLibrary(await routeStore.list())
}
routeHud.onLoad = async (id) => {
  if (!id || !routeStore) return
  const r = await routeStore.load(id)
  if (!r) return
  route = r
  params.routeName = r.name
  ensureRouteLayer()
  refreshRoute()
  gui.controllersRecursive().forEach((c) => c.updateDisplay())
}
routeHud.onDelete = async (id) => {
  if (!id || !routeStore) return
  await routeStore.remove(id)
  refreshLibrary()
}
refreshLibrary()
```

**Step 2: 验证**

Run: `npm test && npm run build`
Expected: all tests pass;build exit 0
人工:打 ≥3 点 → 剖面折线与统计文本出现;保存 → 刷新页面 → 线路库选中加载 → 线路复原;删除后列表消失。

**Step 3: Commit**

```bash
git add src/route/RouteHud.js src/main.js src/style.css
git commit -m "feat(hud): elevation profile panel + route library UI"
```

**Acceptance:** `npm test` 全绿 + `npm run build` exit 0;人工:剖面/保存/加载/删除全流程可走通
**Covers:** R3(UI)、R4、R5(UI)
**Execution:** serial

---

### Task 11: followups 与收尾

**Objective:** v1.1 defer 项落盘;README 更新;全量验证。

**Files:**
- Create: `docs/followups.md`
- Modify: `README.md`(顶部加 trip-3d 段)

**Step 1: followups**

Create `docs/followups.md`:

```markdown
# trip-3d followups (v1.1+)

- [ ] 途经点拖拽改线(raycast 命中 marker 后拖动,实时重采样)
- [ ] 途经点重命名/编辑 UI(现为 P1..Pn 自动命名)
- [ ] undo/redo 栈(现仅撤销末点)
- [ ] 多线路同屏对比(不同颜色)
- [ ] P2 天气:Open-Meteo provider 实现 + 沿线天气卡 + 晴雨色带(见 brainstorming §4)
- [ ] P3 分享产物:海报卡(Canvas 合成)/ 飞越视频(MediaRecorder)
- [ ] P4 路网吸附:openrouteservice / 高德(GCJ-02 边界转换)
- [ ] 分享 URL 压缩(lz-string)应对长线路 hash 过长
- [ ] 移动端触控(双指旋转与单指打点手势冲突消解)
```

**Step 2: README**

`README.md` 顶部(monolith 原标题后)插入:

```markdown
> **trip-3d fork**:在 monolith-terrain(MIT)底座上增加线路规划 —— 3D 地形打点成线、
> 高程剖面、线路库(IndexedDB)、GPX 导入导出、URL 分享。实施计划见
> `docs/plans/2026-08-04-p0-p1-waypoint-routing.md`;设计收敛见
> `../brainstorming/2026-08-04-3d-trip-weather-planner-brainstorm.md`。
>
> ```bash
> npm install && npm run dev   # 开发
> npm test                     # 单元测试(vitest)
> npm run build                # 构建
> ```
```

**Step 3: 全量验证**

Run: `npm test && npm run build`
Expected: 全部测试通过(≥19 个);build exit 0

**Step 4: Commit**

```bash
git add docs/followups.md README.md
git commit -m "docs: followups + README for trip-3d fork"
```

**Acceptance:** `npm test && npm run build` → 全绿 + exit 0
**Covers:** 收尾(无新业务需求)
**Execution:** serial

## Requirement Coverage

| Requirement | Task(s) | Verification |
|---|---|---|
| R1 点击落途经点(marker+序号) | Task 3(数据)、8(视觉)、9(交互) | route.test.js;人工 dev 打点 |
| R2 样条贴地连线 | Task 3(采样)、8(渲染) | route.test.js 采样;人工目视贴地 |
| R3 里程/爬升/示意耗时 | Task 3(统计)、10(UI) | route.test.js routeStats;人工核对文本 |
| R4 高程剖面图 | Task 10 | 人工:≥3 点出折线 + 最值标注 |
| R5 线路库 CRUD(IndexedDB) | Task 5、10(UI) | store.test.js;人工刷新后加载 |
| R6 GPX 导入导出 | Task 6、9(按钮) | gpx.test.js 往返;人工下载/导入 |
| R7 URL 分享复原 | Task 7、9(hash 启动) | share.test.js;人工新开标签粘贴链接 |
| R8 坐标双向可逆 | Task 2 | geo.test.js round-trip 1e-6° |
| R9 provider 接口骨架 | Task 4 | providers.test.js |

## Self-Review: 45/50

| 维度(0-5) | 分 | 说明 |
|---|---|---|
| 任务粒度(2-5min~1step) | 4 | Task 9 偏大(120 行集成),但已是单文件内聚改动,拆更碎会破坏上下文 |
| 文件路径精确 | 5 | 全部精确到路径与插入点(main.js 行号锚定已读源码) |
| 代码完整可复制 | 4 | Task 8 首版含 `pts()` 占位败笔,已在文中显式标注修正版;扣分项 |
| 命令精确+期望输出 | 5 | 每个测试命令带期望 passed 数 |
| TDD 覆盖 | 5 | 纯函数全部 RED→GREEN;three.js 胶水层标人工验收(不可单测部分诚实降级) |
| 验证步骤 | 5 | Acceptance 字段每 task 一条,含命令与期望 |
| 无 Hidden Coupling | 4 | Task 9↔10 的占位函数前向依赖已显式声明;Task 8↔9 验收顺序已声明 |
| 无 Wishful Dependency | 5 | 坐标数学锚定已读源码行(dem.js/terrain.js);atob/btoa node18+ 已注明 |
| DRY/YAGNI | 5 | provider 仅骨架;无账号/后端;defer 项全进 followups |
| 回滚/风险 | 3 | 纯增量改动可 git revert;但无显式 rollback 段 —— 扣分项,实施时每个 commit 即回滚点 |

**已识别弱点(实施时注意):**
1. Task 8 的 `RouteLayer.update()` 返回值契约以修正版为准(返回采样点数组,无 `_lastPts` 缓存)。
2. Task 9/10 的 `updateRouteHud`/`refreshLibrary` 先空函数占位、Task 10 替换 —— 实施者不得跳过 Task 10 直接验收。
3. `serializeRoute` 在 main.js import 但 Task 9 代码未直接使用(store.save 内部调用),若 lint 报未用可从 import 中移除。
4. main.js 行号锚点(L25/L48/L566 等)基于 monolith 原版 1020 行;若此前有其他改动漂移,以符号锚点(`loadDem` import、`demExaggeration`、pointer 段)为准。

---

**执行方式:** 按 task 顺序串行;每个 task 完成后跑该 task Acceptance 命令再 commit。纯函数 task(1-7)可委派 subagent;three.js 集成 task(8-10)需人工 dev 验收。
