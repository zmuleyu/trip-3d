# TRIP 3D — 时间、空间与气候的旅行地图

> **在线访问**: https://trip-3d.pages.dev (Cloudflare Pages)

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

The project grew from the upstream terrain experiment, but its current product surface is a map-centered trip workspace rather than a standalone terrain demo. The original procedural terrain, poster, flyover, HUD, and advanced parameter capabilities remain reachable legacy tools; they are not the primary planning information architecture.

**上游演示:** https://kaolti.github.io/monolith-terrain/

## How to use

| Task | Current path |
|---|---|
| Plan a route | Enter **Plan**, search or click the map, then add, select, drag, reorder, reverse, or close waypoints. |
| Choose routing | Use Direct, Walk, or Drive; provider limitations and unavailable duration/elevation remain explicit. |
| Inspect terrain | Switch to **Analyze**. The same route and camera context continue into native MapLibre terrain and the elevation profile. |
| Review weather | Open Weather from the destination rail; the panel uses the current route and selected date. |
| Save or reopen | Save to the browser-local route library. There is no account or server synchronization. |
| Import, export, share | Use GPX import/export, supported Amap links, URL sharing, or poster output from the global actions menu. |
| Adjust the workspace | Desktop information instruments can be moved, resized, brought forward, and reset; compact viewports retain the mobile sheet. |

## Current architecture

- **Trip state:** `src/main.js` currently coordinates the shared route, history, analysis, providers, storage, share, and renderer adapters. The next architecture phase is to extract these responsibilities incrementally without creating a second state model.
- **Plan / Analyze map:** MapLibre owns the map workspace, 2D planning, native terrain, route/waypoint overlays, weather markers, fit padding, and truthful terrain fallback.
- **Legacy Three tools:** Three terrain and its frame scheduler still support procedural terrain, poster/flyover output, advanced settings, and legacy instruments. Plan stops its continuous legacy RAF; Analyze and short camera work wake it when required.
- **UI:** one Planner workspace, destination rail, shared Inspector host, fluid desktop information instruments, and a mobile peek/half/full sheet.
- **Providers and persistence:** routing, geocoding, weather, DEM, administrative overlays, IndexedDB route storage, GPX, and compressed URL sharing remain separate seams around the shared trip.

See [PRODUCT.md](PRODUCT.md) for product behavior, [DESIGN.md](DESIGN.md) for visual authority, and [docs/followups.md](docs/followups.md) for the staged architecture path and deferred capabilities.

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

Pushing to `main` auto-builds and deploys to Cloudflare Pages through the configured Git integration. For a deliberate manual Pages upload, build first and deploy the exact `dist` candidate:

```bash
npm run build
npx wrangler pages deploy dist --project-name trip-3d
```

## Tech

- [MapLibre GL JS](https://maplibre.org/) — Plan/Analyze map workspace, native terrain, route/waypoint layers, map controls, and responsive camera fitting
- [three.js](https://threejs.org) — procedural/legacy terrain tools, poster/flyover output, and advanced terrain rendering
- [postprocessing](https://github.com/pmndrs/postprocessing) — legacy Three depth-buffer DOF, tone mapping, grain, vignette, and SMAA
- [lil-gui](https://lil-gui.georgealways.com) — advanced parameter controls embedded under Settings
- [Vite](https://vitejs.dev) — build; plain JavaScript, no framework
- Browser-local IndexedDB route storage, GPX import/export, compressed URL sharing, Open-Meteo weather, OSRM routing, and Nominatim/Photon geocoding
- Hand-rolled seeded simplex noise / FBM / ridged multifractal and Catmull-Rom flyover tooling remain available to the legacy terrain path

## Elevation data & attribution

Real-world mode uses the **[Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)** dataset (Terrarium encoding), publicly hosted through the AWS Open Data program — no key required.

> Terrain tiles by [Mapzen](https://www.mapzen.com/) / [Tilezen](https://github.com/tilezen/joerd), from the AWS Open Data Terrain Tiles dataset. Underlying data sources include SRTM (NASA), USGS 3DEP/NED, ETOPO1 (NOAA) and others — see the [full attribution list](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

## License

[MIT](LICENSE)

<!-- CF Pages git integration enabled 2026-08-05: push to main auto-builds via `npm run build` → dist/ -->
