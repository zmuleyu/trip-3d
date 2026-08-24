# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

TRIP 3D primarily serves people planning and recording trips in China. They need
to understand a journey before departure and retain a useful record afterward,
without separating route geometry, terrain, schedule, and weather into unrelated
tools.

The primary job is to plan or load a route, inspect it from useful map
perspectives, understand how terrain and weather change along the journey, and
save or share the resulting trip record.

## Product Purpose

TRIP 3D integrates three dimensions of trip information:

- **Time:** trip dates, sequence, duration, day boundaries, and time-dependent
  conditions.
- **Space:** route geometry, distance, elevation, terrain, administrative area,
  and geographic context.
- **Climate:** weather conditions and their relationship to locations and times
  along the trip.

Success means a user can move from route planning to trip understanding and
recording without mentally reconciling separate maps, forecasts, and notes.

## Positioning

TRIP 3D is a map-centered trip planning and recording workspace, not a 3D
terrain demo and not two separate 2D and 3D planners. A trip is one shared
information model. Two-dimensional and three-dimensional maps are alternate
views of the same route, place, time, terrain, weather, selection, and editing
state.

The product is China-first while keeping the underlying trip model suitable for
later geographic expansion. China-first means Chinese language, Chinese travel
contexts, domestic administrative geography, and relevant local interoperability
receive priority; it does not justify silently claiming coverage that a current
data provider does not supply.

## Operating Context

A typical journey is:

1. Start from a place search, an imported route, a saved route, or a shared link.
2. Add and edit waypoints while selecting a routing mode appropriate to the trip.
3. Inspect the same trip in 2D for geographic clarity and in 3D for terrain and
   elevation understanding.
4. Review distance, duration where supported, elevation profile, slope, weather,
   sunlight, and administrative context.
5. Save the route locally, export it, or share a reproducible view.
6. Return later to continue planning or use the saved trip as a record.

Desktop and mobile web are both first-class contexts. On mobile, map gestures
and route editing must remain usable while contextual details are progressively
disclosed.

## Capabilities and Constraints

- Route planning supports direct distance and provider-backed walking or driving
  routes, with truthful degradation when a provider cannot estimate a result.
- A route can be named, edited, reversed, closed, saved to the browser-local
  route library, and imported or exported through existing supported seams.
- GPX import/export, URL sharing, poster output, and existing Amap-link
  interoperability remain product capabilities; provider limitations must stay
  visible.
- Elevation, terrain, route profile, slope styling, distance marks, direction
  arrows, weather, sunlight, and administrative overlays enrich the same trip
  rather than creating parallel workspaces.
- Current administrative-boundary coverage is China-specific. Global coverage is
  a later capability, not an implied current promise.
- Route-library state is browser-local through IndexedDB. The current product has
  no user account or server-side trip synchronization.
- Public search, routing, weather, basemap, and elevation services have distinct
  coverage and availability limits. Failure must be explained and must not be
  presented as complete data.
- Existing route semantics, stored trips, imports, exports, and shared links must
  remain compatible through the redesign unless a later migration is separately
  approved.
- `TRIP 3D` is the canonical product name. `MONOLITH` and “procedural terrain
  experiment” describe the inherited technical origin and are not the product
  identity going forward.

## Brand Commitments

- Product name: **TRIP 3D**.
- Primary market and language: China-first, Chinese-first.
- The map is the product's primary working surface.
- Terrain should remain a meaningful and recognizable capability, while no
  inherited visual style is binding merely because it exists in the current UI.
- Windy is an interaction and map-hierarchy reference, not a visual template or
  brand source to copy.
- Rounded search, controls, and contextual components are a deliberate part of
  the product language. Frosted translucency is reserved for map-anchored
  information that benefits from retaining geographic context.
- The interface must look authored for a mapping product, not assembled from
  generic AI-dashboard patterns: no feature-inventory wall, indiscriminate card
  grid, decorative metrics, pervasive glass, glow, or invented “smart” copy.

## Evidence on Hand

- The current implementation in `src/` contains the working route, map, terrain,
  weather, administrative-area, sunlight, sharing, poster, and local-library
  capabilities.
- `README.md` records the inherited terrain engine and current route-planning
  surface.
- `docs/followups.md` records known capability gaps and provider limitations.
- `docs/audits/2026-08-24-map-centered-experience-audit.md` records the current
  desktop and 390px visual baseline.
- The repository contains no verified customer testimonials, usage metrics,
  commercial claims, or production service-level promise. Future design work
  must not invent them.

## Product Principles

- **One trip, many views:** 2D, 3D, weather, profile, and administrative context
  stay synchronized around one trip state.
- **Map before chrome:** controls support the map and recede when they are not
  needed.
- **Time, space, and climate together:** important decisions should not require
  users to reconcile disconnected surfaces.
- **Planning becomes a record:** work performed before the trip should remain
  useful during and after it.
- **Truthful coverage:** unknown, unavailable, stale, or provider-limited data is
  stated directly and never replaced by a silent approximation.

## Accessibility & Inclusion

The web experience must remain operable with keyboard focus, explicit control
labels, non-color state cues, reduced-motion preferences, and responsive reflow.
The current redesign will target desktop and 390px mobile evidence. A formal
conformance level remains an open product decision; no compliance claim should
be made from screenshots alone.
