---
name: TRIP 3D
description: A restrained Chinese-first cartographic workspace where one trip stays on one map.
colors:
  ink: "#1f2428"
  ink-soft: "#5f696f"
  paper: "#f7f7f4"
  paper-strong: "#ffffff"
  line: "rgba(31, 36, 40, 0.16)"
  line-strong: "rgba(31, 36, 40, 0.28)"
  route: "#f04a1d"
  weather: "#2f80a8"
  success: "#23845f"
  warning: "#b66b12"
typography:
  body:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  trip-title:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  metadata:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  control: "10px"
  card: "14px"
  segmented: "18px"
  sheet: "18px"
spacing:
  tight: "4px"
  compact: "8px"
  control: "10px"
  standard: "14px"
  panel: "16px"
  section: "18px"
components:
  button-primary:
    backgroundColor: "{colors.route}"
    textColor: "{colors.paper-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 17px"
    height: "40px"
  button-secondary:
    backgroundColor: "rgba(255,255,255,.06)"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.control}"
    height: "40px"
  input-search:
    backgroundColor: "rgba(255,255,255,.1)"
    textColor: "{colors.paper-strong}"
    rounded: "22px"
    padding: "0 44px 0 14px"
    height: "40px"
  navigation-rail:
    backgroundColor: "rgba(24, 30, 34, .78)"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.card}"
    padding: "6px"
  map-context:
    backgroundColor: "rgba(247,247,244,.9)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  weather-card:
    backgroundColor: "rgba(250,250,247,.9)"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    width: "248px"
  journey-sheet:
    backgroundColor: "rgba(250,250,247,.94)"
    textColor: "{colors.ink}"
    rounded: "16px"
    height: "58px"
---

# Design System: TRIP 3D

## Overview

**Creative North Star: "The Map Is the Trip"**

TRIP 3D is a restrained, authored Chinese cartography workspace. A continuous natural-terrain map carries the route, while near-black operational chrome makes the controls legible without competing for the first glance. The route-orange line and primary action establish the only urgent visual voice.

The product feels like a dependable field instrument: compact rounded controls, short Chinese labels, ordered row content, and progressive disclosure let planning, terrain, time, and weather remain facets of one trip. Frosted material is reserved for information anchored to the map, so geographic context survives without turning the interface into glass decoration.

**Key Characteristics:**
- Map-first operating canvas with compact corner islands and a single filled route action.
- Natural, quiet terrain and paper-like information surfaces rather than dashboard-card density.
- Restrained Chinese system typography with compact metadata and tabular numerical detail.
- Orange route selection, blue weather information, and direct truthful status colors.
- Rounded, familiar controls; dense information remains in rows, sheets, and drawers.

## Colors

The palette is terrain-neutral and high-contrast: ink and paper establish operational clarity, while route orange is rare enough to keep travel movement and the primary action unmistakable.

### Primary
- **Route Ember:** Carries the active route, selected planning tools, leading selected-row rule, and the one primary filled action.

### Secondary
- **Weather Blue:** Identifies weather-specific links and rain context without competing with route selection.
- **Verified Green:** Communicates success only when a state is actually successful.
- **Field Warning:** Communicates a limitation or warning without impersonating the primary route action.

### Neutral
- **Cartographic Ink:** Anchors text, dark chrome, and the selected route-mode control.
- **Quiet Ink:** Holds metadata and secondary explanation at a lower visual volume.
- **Map Paper:** Forms light map-context surfaces and stable drawers.
- **Strong Paper:** Keeps editable fields and row interiors opaque and readable.
- **Fine Boundary / Strong Boundary:** Separate adjacent operational regions without turning the map surface into a grid.

**The One Route Voice Rule.** Route orange is reserved for the active route, its direct selection state, and the single primary action; it is not a general decorative accent.

## Typography

**Body Font:** Segoe UI, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif.

**Character:** One practical Chinese-capable system stack keeps names, geographic labels, controls, and operational feedback stable across platforms. Weight and compact scale create hierarchy; ornamental display type is absent.

### Hierarchy
- **Trip title** (800, 20px, 1, -0.025em): Brand and desktop TRIP 3D mark.
- **Route identity** (650, 16px, normal): Centered desktop trip name; it reduces to 13px on mobile.
- **Panel title** (600–650, 14–18px): Drawer and sheet headings.
- **Body** (400, 14–16px, 1.5): Controls, route names, and readable operational content.
- **Metadata** (400, 9–12px, 1.2–1.3): Dates, save state, weather detail, and concise secondary labels; numerical readouts use tabular figures where alignment matters.

**The Operational Type Rule.** Use weight, size, and short labels to establish priority; do not add a second display voice or force dense route data into oversized type.

## Layout

The map is the continuous working surface. Floating control groups contain only the actions needed for the current task, frequency, and map context; they may merge, split, or move between states and viewports. Brand/search, trip identity, view/edit, destination access, and contextual tools must never be treated as a fixed island count, rail length, or component quota. Inspectors and analysis layers reflow rather than competing with map controls.

On desktop, the default Analyze state is map-first: the route corridor, current position, and one compact analysis layer remain visible; lower-frequency operations recede to a rail, overflow, or on-demand drawer. The distilled D1 preview's three top groups, short rail, and bottom profile band are one useful arrangement for that state—not a global layout prescription. At 1080px, secondary weather and layer triggers recede before the map loses working area.

At 720px and below, map gestures retain priority. The analysis layer becomes a shared bottom sheet with peek, working-half, and full states; it keeps the map visible, leaves the key action reachable, and can be collapsed without losing route context. A mobile control group may combine the actions represented by desktop groups; it does not reproduce desktop chrome mechanically.

**The Continuous Map Rule.** Chrome floats above the map with a visible geographic margin or collapses into an analysis layer, map anchor, side context, or shared sheet according to task. No open state may fragment the trip into competing dashboard columns, form a rigid four-edge frame, or turn the map into background decoration.

### Analyze hierarchy and route terrain seam

Analyze starts with only what is needed to read the journey: map, Route Ember corridor, elevation profile, current position, and one core value. `路线详情`按需展示路线、高程、坡度与可用状态；内部数据来源或参数不进入用户可见层级。剖面与详情构成一个连续、可收起的信息层，无论位于底部、侧边或锚定地图，都保持地图上下文。

Route Ember is the sole strong visual on the working map. Terrain outside the corridor stays low contrast; terrain detail may progressively resolve along the route. Future P6 terrain availability enters through one small truthful route-terrain status capsule (for example, `路线地形 · 正在补齐`) and corridor refinement only. It must not introduce a separate terrain-management destination or invent coverage, completion, weather, dates, risk, or analytics.

## Elevation & Depth

The system is flat by default. Ordinary rows, fields, segmented controls, and list containers use paper, boundary lines, and grouped spacing rather than lift. A single restrained soft shadow supports floating map context, drawers, and weather cards; dark map controls use translucent dark material to remain peripheral over geography.

### Shadow Vocabulary
- **Floating map context** (`0 10px 30px rgba(18, 24, 28, 0.16)`): Used by drawers and elevated map-anchored context only.
- **Dark edge-control lift** (`0 8px 24px rgba(8,12,14,.22)`): Separates compact dark controls from variable terrain.
- **Weather-card lift** (`0 12px 32px rgba(6,10,12,.22)`): Keeps the marker-anchored weather outlet readable without theatrical depth.

**The Flat-First Rule.** Use elevation only to establish a floating map context; do not add shadows to ordinary content rows or invent a card hierarchy.

**The Contextual Frost Rule.** Blur belongs exclusively to map-anchored information and dark/light map controls, with opaque fallbacks when reduced transparency is requested.

## Shapes

Forms are rounded, compact, and repeatable. Ordinary controls use a gently curved 10px radius; cards and dark edge groups use 14px; segmented controls are capsule-adjacent at 18–20px. Mobile sheets use 18px only on their exposed top corners. Journey rows remain square within their shared 12px container so a route reads as a sequence rather than a grid of cards.

**The Grouped Row Rule.** Reserve rounded outer corners for a meaningful group; internal rows divide with fine lines and selection rules instead of acquiring individual card silhouettes.

## Components

### Command buttons
- **Primary continuation:** Route Ember fill, white text, 40px height, 10px radius, and 17px horizontal padding. Hover darkens the orange; pressed state scales to 0.98.
- **Secondary and icon actions:** 40px compact transparent controls on dark chrome with a fine translucent border. Hover adds a restrained white veil; focus uses the route-orange 2px outline.
- **State:** Buttons expose hover, focus-visible, active, disabled, and selected treatment. Motion is limited to color/border at 140ms and press-scale at 100ms.

### Search island
- **Shape:** Desktop combines the brand and a persistent 238px, 12px-radius search field inside one compact dark island. At narrower widths it returns to a 40px trigger and expands only while focused.
- **State:** Focus strengthens the field boundary without changing its position; placeholder text remains muted but legible.

### View switch and segmented controls
- **Style:** Compact 2–3px inner padding inside an 18–20px rounded group; the active segment receives a pale translucent fill and white text.
- **State:** The active choice is expressed by both fill and text contrast, never color alone.

### Navigation rail
- **Style:** A rail is a compact destination affordance when persistent access earns map area. Its length, placement, and labels follow task frequency and viewport; it may collapse into an overflow or shared mobile control group. Active labels appear in a small adjacent chip rather than widening the map chrome.
- **State:** Active work uses a one-pixel Route Ember rule, a quiet translucent fill, and a readable label chip or equivalent accessible label. It never forces a fixed desktop/mobile navigation shape.

### Map context and controls
- **Style:** Map labels use a 10px-radius light frosted context card; map-operation controls sit in a 14px-radius dark frosted group with 40px buttons.
- **State:** Map control hover adds only a quiet translucent light fill. Context stays anchored at the map edge and never reads as a general card surface.

### Journey summary and itinerary rows
- **Style:** Summary, itinerary, and analysis information use one continuous lined layer rather than a fixed spine, metric wall, or card set. The layer may sit at the bottom, beside the map, or at a map anchor when that placement preserves the task's geography. Expanded route detail remains a progressive disclosure; itinerary rows stay 58px minimum inside one outlined sequence.
- **State:** Selected rows use both a thin Route Ember leading rule and a 6% orange fill. The information layer expands, collapses, or relocates with context; mobile reuses its peek/half/full sheet instead of duplicating desktop composition.

### First-use route guidance
- **Style:** Guidance follows the map cursor with one short action label while a compact step strip sits above the summary: `设置起点 → 添加途经点 → 确认路线`.
- **State:** It appears only before the second point, updates immediately after the first click, offers `跳过引导`, and never blocks the central map or impersonates a modal.

### Weather card
- **Style:** A marker-anchored 248px card with a 14px radius, 12px blur, fine border, one restrained shadow, and a light 90% surface on 2D maps or dark 82% surface on 3D terrain.
- **State:** It opens and moves with 130ms opacity/transform feedback, supports dismissal, and switches to an opaque surface for reduced-transparency preferences.

### Settings and menus
- **Style:** Every desktop inspector uses a compact near-black header cap, warm-paper body, 12–16px rounded boundary, fine dividers, and 40–42px controls. Overflow menus remain small, anchored, and grouped by meaning.
- **State:** Destination access uses the smallest contextual rail, overflow, anchor, or drawer that keeps the map usable; no one control placement is globally mandatory. Planning, weather, saving, sharing, export, settings, and Admin each retain a discoverable single-purpose entry without competing with default Analyze. Planning orders naming, route mode and one continuous waypoint sequence, disclosed import/edit/export tools, then its save action. Weather reads the live route only, provides Today/Tomorrow/custom-date selection, automatically uses representative route points, and presents truthful forecast or ERA5/archive availability.

## Do's and Don'ts

### Do:
- **Do** keep the map and route as the default visual proof of the product.
- **Do** use Route Ember only for movement, explicit selection, and the one primary action.
- **Do** keep high-frequency controls compact at 40px on desktop and reachable at 44px touch targets on mobile.
- **Do** use frosted dark or light material only for map-anchored context, with an opaque reduced-transparency fallback.
- **Do** group itinerary, settings, and metrics into lined rows with progressive disclosure.

### Don't:
- **Don't** turn the workspace into a generic AI dashboard, feature-wall card grid, or decorative metric wall.
- **Don't** use pervasive glass, glow, gradient identity, or invented smart claims.
- **Don't** give every field, metric, or itinerary segment its own rounded card.
- **Don't** use hover lift, bounce, broad `transition: all`, or decorative entrance sequences.
- **Don't** silently hide unavailable, stale, or provider-limited trip information behind polished visual treatment.
