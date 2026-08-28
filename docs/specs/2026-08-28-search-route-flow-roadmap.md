---
title: Search and route intent flow roadmap
status: R5 active and frozen
updated: 2026-08-28
scope: R5 bounded public-provider reliability
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

## R4 — completed

Mobile gesture ownership and accessibility work uses the settled R3 choice and
stale-result seam. Plan accepts a deliberate blank-map tap, preserves MapLibre
pan and multi-touch gestures, and permits waypoint preview only after the drag
hysteresis threshold. Analyze remains read-only. The mobile sheet, global menu,
and attribution preserve the map working area without overlap.

## R5 — active and frozen

Public Nominatim/Photon search and FOSSGIS OSRM routing remain **light-use
only**, with no production SLA. Search stays explicit-submit: a latest-only
1.1-second gate sends at most one Nominatim request and, only when that service
is unavailable, one visibly labelled Photon fallback request. A Nominatim
no-result does not fan out. Route edits keep only the latest geometry, start at
most one FOSSGIS request per 1.1 seconds, and keep both R3 alternatives inside
that single response. There are no background retries or per-segment fan-outs.

Provider calls accept cancellation and have bounded timeouts. Cancellation,
stale completion, no result, primary-to-fallback, and all-provider unavailability
remain distinct transient states. Small in-memory caches retain only successful
normalized search or route results; failures are not cached. Provider metadata
is UI-only and does not enter Trip, storage, share, GPX, weather, or analysis
contracts. Timeout and cancellation bound browser work but are not a global
usage or billing circuit breaker.

### Public-service policy evidence

Checked 2026-08-28 against current official policy/repository pages:

- Nominatim public API: donated, limited-capacity service; absolute maximum one
  request per second, applied to the website/application aggregate; moderate
  direct end-user searches only; client-side autocomplete forbidden; caching
  and switchability expected; policy or access may change without notice.
  <https://operations.osmfoundation.org/policies/nominatim/>
- Photon at `photon.komoot.io`: the official repository calls it a public demo;
  only a reasonable request volume is accepted, extensive use may be throttled
  or banned, availability is not guaranteed, and changes may arrive without
  notice. <https://github.com/komoot/photon#demo-server>
- `routing.openstreetmap.de`: FOSSGIS requires at most one request per second,
  forbids heavy use/scraping, may change or discontinue the service without
  notice, and guarantees no availability. The endpoint runs OSRM with distinct
  public foot/car/bike profiles. <https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/>
  and <https://routing.openstreetmap.de/about.html>
- OSRM is the open-source routing engine; the public FOSSGIS host is an external
  service boundary, not an OSRM production entitlement.
  <https://github.com/Project-OSRM/osrm-backend>

One explicit search action therefore has a worst-case multiplier of primary 1 +
fallback 1 = 2 provider requests. One coalesced route edit has a worst-case
multiplier of 1; `alternatives=true` does not add a second request; automatic
retry multiplier is 0. Photon has no numeric allowance, and neither Photon nor
FOSSGIS provides an SLA. Nominatim's aggregate application limit cannot be
guaranteed by independent browser gates. Before production-scale use, a
separate authorization must choose an Amap/commercial provider, a globally
limited gateway, or self-hosted Nominatim/Photon/OSRM. R5 does not create or
deploy that infrastructure.
