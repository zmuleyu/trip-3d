---
title: Search and route intent flow roadmap
status: active
updated: 2026-08-28
scope: R2 non-blocking route enrichment
---

# Search and route intent flow roadmap

## R1 — completed

Desktop and 390px use one shared search state. Every result shows its place name,
city/district/province context, and category without relying on hover or a title
attribute. Selecting a result enters `PlaceSelection`; it does not change the
route until the user explicitly chooses **设为起点**, **设为终点**, **添加途经点**,
or **仅查看**.

After a role is chosen, the existing single-trip route flow calculates one route
and reports a plain-language state: calculating, available, or a straight-line
fallback. A fallback explicitly says that it has no duration and offers the
smallest recovery action.

## R2 — active and frozen

Plan route mutations from search, the map, waypoint movement, and reordering take
effect immediately in the single `TripRouteController` route. Routing and its
straight-line fallback depend only on route coordinates and mode. DEM loading,
waypoint elevation, route elevation analysis, and 3D terrain are background
enrichment bound to `route.id`, `geometryRevision`, and the current run identity;
loading, failure, cancellation, or stale completion cannot block editing or
replace a newer route.

Plan remains editable, saveable, and shareable while elevation is loading or
unavailable. Analyze reports elevation loading or unavailable truthfully and can
recover when current-run enrichment succeeds. Stored routes, share links, GPX,
weather, Admin, poster, flyover, and provider fallback contracts remain compatible.

## Later dependencies (not part of R2)

- R3: route results and alternatives depend on R2's single-route ownership and stale-result boundary.
- R4: mobile gesture and accessibility work depends on the settled R2 mutation seam.
- R5: provider productionization remains a separate cost, policy, and production-authority phase.
