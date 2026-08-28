# trip-3d followups (after v0.4.1)

Completed delivery baseline: [R1–R5 search and route flow](specs/2026-08-28-search-route-flow-roadmap.md) for v0.4.0.

## Architecture evolution

The current production baseline keeps one shared trip across MapLibre Plan/Analyze,
local storage, weather, save, and share. Continue architecture work one reviewed
Goal at a time; do not combine these phases into a broad rewrite.

- [x] S1: extract a renderer-neutral `TripRouteController` that owns route mutation,
  selection, history, revision, day boundaries, and derived route stats. Preserve
  stored-route, share-link, GPX, provider, MapLibre, Three, and UI behavior.
- [x] S2: after S1 review, extract a workspace lifecycle coordinator for Plan/Analyze,
  frame scheduling, renderer activation, fit/safe-area, and fallback transitions.
- [x] S3: isolate poster, flyover, procedural terrain, and legacy HUD consumers behind
  `LegacyTerrainToolsAdapter` ports without creating a second trip state or an idle RAF path.
- [x] S4: retain poster/flyover and their minimum real-DEM camera/output seam; retire
  procedural terrain, legacy HUD, lil-gui, Tour, and Scan. Automatic Pages Git
  deployments are disabled so source delivery and production release remain separate.
- [x] G1: make `plan/analyze` the only workspace state. Plan owns editable MapLibre
  2D; Analyze owns read-only MapLibre terrain. Weather, Library, Share, and the
  planning Inspector are overlays or destinations and no longer create a second
  `browse/planning` mode. Route mutation guards now validate the workflow stage
  directly while storage, share, GPX, and truthful terrain fallback remain separate
  compatibility and recovery boundaries.

Architecture constraints:

- Keep MapLibre 2D/native terrain, `frameScheduler`, route mutation guards, truthful
  provider fallbacks, and stored/share compatibility until an exact replacement is proven.
- Do not run a standalone whole-file CSS rewrite. Remove dead selectors and consolidate
  active instrument rules only while changing their owning component.
- Stop a phase when it would require the next phase, a product decision, provider change,
  storage/share migration, or production activation.

- [ ] 天气:场景天气粒子(雨/雪氛围,shader 级,美学增强)
- [ ] 天气:RainViewer 雷达回波贴图 draping(P3 评估)
- [ ] 多线路同屏对比(不同颜色)
- [ ] P4 路网吸附:openrouteservice / 高德(GCJ-02 边界转换,provider 骨架已就位)
- [ ] 移动端触控(双指旋转与单指打点手势冲突消解)
- [ ] 分享链接含 exaggeration/相机视角等视觉参数(现仅 dem 中心+zoom+waypoints)
- [ ] 生产规模路由路径：当前 FOSSGIS routed-foot/car 仅 light-use、每秒最多 1 请求且无 SLA；需另行授权 gateway/商业服务或自建 osrm-backend profile
- [ ] 高德实体化:AmapProvider(key 管理 + GCJ-02 转换 + 条款评估;geocode/routing stub 已占位,调用即抛)
- [ ] 生产规模搜索路径：Photon 已核对为无可用性保证的 public demo fallback；主用需另行授权 gateway/商业服务或自托管
- [ ] 搜索:结果分类图标(town/peak/river 等 type 可视化)
- [ ] 部署:自定义域名(当前 trip-3d.pages.dev)
- [ ] 避开高速:需自托管 OSRM 且 profile 加载 exclude 类(FOSSGIS 公共 routed-car 实测返回 InvalidValue "Exclude flag combination is not supported",provider 已支持 exclude 参数+InvalidValue 优雅降级,UI 待自托管后启用)
- [ ] 行政区划境外覆盖:Natural Earth admin_1(全球省级),L1 当前仅中国(DataV)
