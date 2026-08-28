# TRIP 3D — 时间、空间与气候的旅行地图

> **在线访问**: https://trip-3d.pages.dev (Cloudflare Pages)
> **源码版本**: v0.4.0；R1–R5 搜索与路线流程已完成。公共搜索与路由 provider 仍仅限 light use，不提供生产 SLA。

TRIP 3D 是以地图和路线为核心的旅行规划与记录工具。用户在 Plan 中编辑同一条路线，在 Analyze 中查看同一空间状态的地形与高程；路线库、沿途天气、GPX、保存和分享都围绕同一个 trip model 工作。

本项目基于 [monolith-terrain](https://github.com/kaolti/monolith-terrain) 的 MIT 许可基础演进而来；其地形渲染与数据来源说明保留在本文档中。

实施计划与三轮 Codex review 记录见
`docs/plans/2026-08-04-p0-p1-waypoint-routing.md`;设计收敛见
`../brainstorming/2026-08-04-3d-trip-weather-planner-brainstorm.md`;v1.1+ 见 `docs/followups.md`。
>
> ```bash
> npm install && npm run dev   # 开发
> npm test                     # 单元测试(vitest)
> npm run build                # 构建
> ```

The project grew from the upstream terrain experiment, but its current product surface is a map-centered trip workspace rather than a standalone terrain demo. Poster and flyover remain secondary trip outputs; procedural terrain, the experimental HUD, Tour/Scan, and the lil-gui parameter surface have been retired.

**上游演示:** https://kaolti.github.io/monolith-terrain/

## How to use

| Task | Current path |
|---|---|
| Plan a route | Enter **Plan**, search or click the map, then add, select, drag, reorder, reverse, or close waypoints. |
| Choose routing | Use Direct, Walk, or Drive; provider limitations and unavailable duration/elevation remain explicit. |
| Inspect terrain | Switch to **Analyze**. The same route and camera context continue into native MapLibre terrain and the elevation profile. |
| Review weather | Open Weather from the destination rail; the panel uses the current route and selected date. |
| Save or reopen | Save to the browser-local route library. There is no account or server synchronization. |
| Import, export, share | Use GPX import/export, supported Amap links, URL sharing, poster output, or flyover recording from the global actions menu. |
| Adjust the workspace | Desktop information instruments can be moved, resized, brought forward, and reset; compact viewports retain the mobile sheet. |

## Current architecture

- **Trip state:** `src/lib/tripRouteController.js` owns the single shared route, waypoint selection, mutation/history, revisions, day boundaries, and derived route analysis. `src/main.js` coordinates providers, storage/share codecs, and renderer adapters through that controller without a second state model.
- **Workspace lifecycle:** `src/lib/workspaceLifecycleCoordinator.js` is the single Plan/Analyze transition entry for MapLibre workspace activation, native-terrain/2D fallback, safe-area fitting, and legacy frame scheduling. Renderer and UI internals remain behind lifecycle ports.
- **Plan / Analyze map:** MapLibre owns the map workspace, 2D planning, native terrain, route/waypoint overlays, weather markers, fit padding, and truthful terrain fallback.
- **Retained output renderer:** `LegacyTerrainToolsAdapter` contains poster/flyover output, real-DEM rebuild, and the minimum camera seam through injected ports. Plan stops its continuous legacy RAF; only explicit output or camera work wakes it.
- **UI:** one Planner workspace, destination rail, shared Inspector host, fluid desktop information instruments, and a mobile peek/half/full sheet.
- **Providers and persistence:** routing, geocoding, weather, DEM, administrative overlays, IndexedDB route storage, GPX, and compressed URL sharing remain separate seams around the shared trip.

See [PRODUCT.md](PRODUCT.md) for product behavior, [DESIGN.md](DESIGN.md) for visual authority, and [docs/followups.md](docs/followups.md) for the remaining staged architecture path and deferred capabilities.

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static build in dist/
```

### Codex worktree fast path

Codex worktrees use the checked-in local environment at `.codex/environments/environment.toml`.
On a fresh worktree it runs the checked-in bootstrap once, preferring the shared npm cache and
skipping installation when the lockfile-backed dependencies are already ready.

Use one preview process for manual iteration:

```bash
npm run dev:acceptance  # http://127.0.0.1:4173
```

For a repeatable visual gate, run:

```bash
npm run acceptance
```

The gate builds once, starts one temporary preview server and one headless browser session, then
captures fixed 1440x900 desktop and 390x844 mobile viewports. Evidence is written under
`.codex/evidence/acceptance/` and is intentionally ignored by Git. It never uses full-page capture.

For the smallest safe test set for the current branch and working tree, run:

```bash
npm run test:changed
```

The selector follows relative imports back to affected tests. Shared configuration, runtime source
without reachable tests, or an unavailable base ref fails closed to the complete Vitest suite;
documentation-only changes run no product tests. Use `-- --list --files <path...>` to inspect a
decision without executing it.

No API keys or environment variables needed.

## Deploy

Automatic Git deployments are disabled for production and preview branches. A deliberate Pages release is a separate authority gate: build the exact candidate, deploy it manually, and verify both the immutable deployment URL and `https://trip-3d.pages.dev`.

```bash
npm run build
npx wrangler pages deploy dist --project-name trip-3d --branch main \
  --commit-hash <full-main-sha> --commit-dirty=false
```

Before source merge and again after release, verify Pages branch controls still keep automatic production deployments disabled and preview deployment set to `none`.

## Tech

- [MapLibre GL JS](https://maplibre.org/) — Plan/Analyze map workspace, native terrain, route/waypoint layers, map controls, and responsive camera fitting
- [three.js](https://threejs.org) — retained real-DEM poster/flyover output renderer
- [postprocessing](https://github.com/pmndrs/postprocessing) — retained poster/flyover DOF, tone mapping, grain, vignette, and SMAA
- [Vite](https://vitejs.dev) — build; plain JavaScript, no framework
- Browser-local IndexedDB route storage, GPX import/export, compressed URL sharing, Open-Meteo weather, OSRM routing, and Nominatim/Photon geocoding
- Hand-rolled seeded noise remains limited to real-DEM surface texture and label placement; flyover math remains a bounded output seam

### Public search and routing providers

The current browser integration is for light use, not a production SLA. Place
search is explicit-submit only and uses OSM Nominatim with a visibly labelled
Photon demo fallback when Nominatim is unavailable. Routing uses the FOSSGIS
`routing.openstreetmap.de` OSRM service. Requests are latest-only, gated,
cancelable, time-bounded, and cached in small success-only memory caches; there
are no background retries. A search action makes at most one primary plus one
fallback request, while one coalesced route edit makes at most one request and
receives any route alternatives in that response.

Official policies checked 2026-08-28: [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/),
[Photon demo-server terms](https://github.com/komoot/photon#demo-server), and
[FOSSGIS routing terms](https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/)
plus its [service description](https://routing.openstreetmap.de/about.html).
Nominatim's one-request-per-second ceiling applies to aggregate application
traffic, which independent browser throttles cannot guarantee at production
scale. Photon and FOSSGIS give no availability guarantee and may change or end
access. Production-scale use therefore requires separate authorization for a
globally limited gateway, self-hosted services, or an approved commercial/Amap
provider. Timeout and cancellation are resource boundaries, not usage caps.

## Elevation data & attribution

Real-world mode uses the **[Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)** dataset (Terrarium encoding), publicly hosted through the AWS Open Data program — no key required.

> Terrain tiles by [Mapzen](https://www.mapzen.com/) / [Tilezen](https://github.com/tilezen/joerd), from the AWS Open Data Terrain Tiles dataset. Underlying data sources include SRTM (NASA), USGS 3DEP/NED, ETOPO1 (NOAA) and others — see the [full attribution list](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

## License

[MIT](LICENSE)
