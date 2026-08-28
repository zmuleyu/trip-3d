---
title: Search and route intent flow roadmap
status: R4 active and frozen
updated: 2026-08-28
scope: R3 bounded route-result alternatives
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

## R2 — completed

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

## R3 — completed

One existing OSRM request may yield up to two structurally valid route results.
The active result is transiently bound to `route.id`, `geometryRevision`, mode,
and the request/result identity. Desktop and 390px users can identify and select
one of the two choices by order and distance/duration text, while MapLibre shows
the unselected option as a subdued dashed line. The selected result supplies the
derived map geometry, summary, legs, and Analyze input without changing the
single Trip route, revision, history, save/share, or GPX contracts.

Malformed candidates fail closed. One result or a routing failure retains the
existing single-route or truthful straight-line fallback state with no empty
selector. A route or mode change invalidates all prior candidates.

## R4 — active and frozen

Mobile gesture ownership and accessibility work uses the settled R3 choice and
stale-result seam. Plan accepts a deliberate blank-map tap, preserves MapLibre
pan and multi-touch gestures, and permits waypoint preview only after the drag
hysteresis threshold. Analyze remains read-only. The mobile sheet, global menu,
and attribution preserve the map working area without overlap.

## R5 dependency (not part of R4)

Provider productionization, response-size policy, caching, and rate controls
remain a separate cost, policy, and production-authority phase.
