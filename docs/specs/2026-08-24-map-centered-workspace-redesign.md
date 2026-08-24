---
title: TRIP 3D map-centered workspace redesign
status: approved
updated: 2026-08-24
scope: whole web interface, desktop and 390px mobile
---

# TRIP 3D map-centered workspace redesign

## Job and audience

TRIP 3D serves China-first trip planners and recorders who need route geometry,
terrain, time, and weather to behave as one trip. The surface is **Operate**:
the map stays visible while the user plans, inspects, records, and returns to a
trip. Two-dimensional and three-dimensional maps are views of the same state.

## Outcome and proof

The default viewport proves the product through the active route on a continuous
map, not through a feature list. A user can identify the trip, continue planning,
inspect a day or segment, enter weather mode, and save without opening several
competing panels. Desktop and 390px mobile preserve the same route, selection,
time, weather, and save state.

## Selected direction

Combine the approved concept's restrained, natural terrain map with a compact
row-based journey list. The map owns about 85% of the default viewport. Rounded
controls and anchored frosted weather cards provide the product character;
opaque drawers and row separators handle dense settings and itinerary content.

Approved concept reference:
`.impeccable/mocks/approved/trip3d-map-workspace-concept.png`.

The concept is a composition reference, not a literal default-state screenshot:
the itinerary and weather card are collapsed until invoked, and the refinements
in this brief outrank visible concept details where they differ.

## Default information hierarchy

The default viewport shows only:

1. the map, route, essential labels, and selected state;
2. TRIP 3D and a collapsed search trigger;
3. active trip name, dates, and save state;
4. one primary action, **继续规划**;
5. a one-line configurable itinerary summary;
6. compact map-view and map-operation controls.

Weather details, the full itinerary, tool labels, layer configuration, import or
export actions, and experimental settings are closed by default. At most one
primary panel and one map-anchored popover may be open at once.

## Layout topology

### Desktop

- A slim top command bar carries brand, expanding search, trip identity, one
  primary action, and compact weather, layer, and more triggers.
- A left edge tool group exposes at most four high-frequency planning tools.
  Labels appear on focus, hover on fine pointers, or active/open state.
- Map/terrain, zoom, fit, and location controls stay attached to the map edge.
- The bottom summary is approximately 56px. It expands as one journey surface,
  not a grid of cards.
- Drawers enter from the right without moving the map's center unexpectedly.

### Mobile at 390px

- The map stays full width behind one bottom working sheet.
- Sheet states are summary, half, and full. Planning, weather, itinerary detail,
  and settings reuse that one sheet instead of stacking.
- Weather points use tap-to-open and tap-to-pin; no hover behavior is simulated.
- Primary map operations remain reachable above the sheet and have 44px targets.

## Component language

### Radius family

| Component | Radius |
| --- | --- |
| Search | 20-22px |
| Ordinary and icon buttons | 10-12px |
| Segmented map/terrain control | 18-20px |
| Map popovers | 14px |
| Menus and drawers | 14-16px |
| Mobile sheet | 18px top corners |

Rows remain rows; radius does not turn every field, metric, or itinerary segment
into a separate card.

### Buttons and feedback

- Desktop controls are approximately 40px; touch targets are at least 44px.
- Every button covers default, hover on fine pointers, pressed, focus-visible,
  selected, loading, and disabled states.
- One surface has one primary filled action. Selection uses at least two of fill,
  border, icon, text, or shape so color is never the only signal.
- High-frequency map and list selection updates immediately. Menus and popovers
  use 120-160ms opacity or transform feedback. There is no hover lift, bounce,
  decorative entrance sequence, or broad `transition: all`.

### Typography and icons

- Use one practical Chinese system stack with 14-16px body text, 12px metadata,
  and restrained 20px trip titles.
- Use the existing icon system or one consistent line family at one stroke
  weight. Do not mix emoji, filled symbols, and unrelated icon dialects.

## Configurable summary

Summary behavior has **自动** and **自定义** modes.

Automatic mode selects useful fields from available data and context. Planning
prefers distance, duration, ascent, and weather risk. When weather is unavailable,
it substitutes valid route or elevation data rather than rendering empty fields.
Past trips may prioritize dates, duration, distance, and recorded points.

Custom mode lets the user enable and order fields. Desktop shows at most four;
mobile shows at most two. Available fields include days, dates, distance,
duration, ascent, descent, maximum elevation, waypoint or segment count,
temperature range, precipitation, wind, weather-risk count, save state, and last
update time. A **恢复推荐** action restores the product default.

The preference is local UI configuration. It does not change route records,
imports, exports, shared URLs, or the trip schema.

## Journey list

Expanding the summary shows one grouped D1/D2/D3 list. Each row contains date,
start and end, distance or duration, elevation change, and weather summary. A
selected row uses a thin orange leading rule, restrained fill, and a matching map
segment highlight. Hourly detail is a deeper state reached from the selected row,
not a permanent sixteen-tile sequencer.

## Weather mode

Weather mode exposes only fresh, route-bound representative or waypoint weather
markers. It never issues a request on pointer movement.

### Fine pointer

- Hovering a weather point for roughly 100ms opens one anchored temperature card.
- The card stays open while the pointer moves between marker and card and closes
  roughly 150ms after leaving both.
- Clicking pins the card. Escape, a second click, or clicking blank map closes it.
- The card is marker-anchored, viewport-aware, and never follows every cursor
  pixel or covers its own trigger.

### Touch and keyboard

- First tap opens and pins. Tapping the map or dismissing the sheet closes.
- Route/weather lists expose the same points to keyboard users. Focusing a point
  highlights it on the map and opens the same information outlet.
- Announcements are concise and do not repeat on every pointer move.

### Temperature card

The compact card shows place and time, temperature and condition, precipitation,
wind, freshness/source state, and **逐小时预报**. Feels-like temperature,
direction, gusts, visibility, humidity, and full hourly values belong to the
expanded detail.

Frosted material is exclusive to map-anchored content:

- dark terrain uses a 78-84% opaque dark surface;
- bright 2D maps use an 86-92% opaque light surface;
- about 12px blur, a fine translucent border, one restrained shadow, and 14px
  radius retain context without sacrificing text contrast;
- reduced-transparency preferences and unsupported browsers receive an opaque
  fallback.

The current weather overlay must be enriched from already loaded results with
place, timestamp, temperature, weather code, precipitation, and wind. Hover reads
those local properties only. Arbitrary-location weather remains an explicit query,
not a pointer-driven network loop.

## More and advanced settings

**更多** owns route library, sharing, GPX import/export, records, and the entry to
**进阶设置**. Advanced settings owns preferences only:

- map and terrain;
- route expression;
- time and weather;
- geographic layers;
- summary display;
- weather interaction;
- experimental HUD, material, motion, and performance controls in a separate
  collapsed group.

## States and failure behavior

- Empty: search, import, or add the first point without a feature inventory.
- Loading: keep the map and stable trip visible; loading owns the initiating
  control or relevant anchored region.
- Weather unavailable or stale: retain route state and state the limitation.
- 3D unavailable: preserve synchronized 2D planning and explain the degradation.
- Local storage unavailable: saving fails visibly and never pretends to persist.
- Dense routes, sixteen-day weather ranges, long Chinese names, and provider
  warnings must wrap or progressively disclose without covering the map.

## Anti-goals

- No provider, route-data, IndexedDB, GPX, or shared-link semantic changes.
- No account system, server trip sync, production deployment, or paid service.
- No feature-card wall, card-in-card dashboard, decorative metric grid, generic
  glass surface everywhere, gradients or glow used as product identity, or
  invented AI/smart claims.

## Validation and success

- Preserve existing behavior-focused unit coverage and add focused component,
  summary-preference, weather-overlay, and interaction tests where behavior changes.
- Build the local candidate and run the affected test set.
- Inspect desktop and 390px mobile together, covering default, planning,
  itinerary-open, weather hover/pinned, settings, empty, loading, and error states.
- The map owns the default viewport, no duplicate primary action remains, summary
  customization survives refresh, weather hover performs no network calls, and
  mouse, touch, and keyboard reach equivalent weather information.
