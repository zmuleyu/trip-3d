---
name: TRIP 3D
description: A restrained Chinese-first cartographic workspace where one trip stays on one map.
colors:
  ink: "#1f2428"
  ink-soft: "#5f696f"
  instrument: "#171c1f"
  paper: "#f7f7f4"
  terrain-paper: "#eef0ee"
  context-paper: "#f6f4ee"
  paper-strong: "#ffffff"
  line: "rgba(31, 36, 40, 0.16)"
  line-strong: "rgba(31, 36, 40, 0.28)"
  route: "#ff4f17"
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
  action: "8px"
  context: "10px"
  instrument: "12px"
  inspector: "14px"
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
    rounded: "{rounded.action}"
    padding: "0 17px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.action}"
    height: "42px"
  input-search:
    backgroundColor: "rgba(255,255,255,.1)"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.action}"
    padding: "0 44px 0 14px"
    height: "40px"
  navigation-rail:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.instrument}"
    padding: "4px"
  map-dock:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.context}"
    width: "48px"
  map-context:
    backgroundColor: "rgba(247,247,244,.9)"
    textColor: "{colors.ink}"
    rounded: "{rounded.context}"
    padding: "8px 11px"
  weather-card:
    backgroundColor: "rgba(250,250,247,.9)"
    textColor: "{colors.ink}"
    rounded: "{rounded.inspector}"
    width: "248px"
  journey-sheet:
    backgroundColor: "rgba(250,250,247,.94)"
    textColor: "{colors.ink}"
    rounded: "{rounded.inspector}"
    height: "62px"
  stage-switch:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.paper-strong}"
    rounded: "12px"
    padding: "3px"
    height: "48px"
  elevation-profile:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.paper-strong}"
    rounded: "12px"
    padding: "0 18px"
---

# Design System: TRIP 3D

## Overview

**Creative North Star: "The Map Is the Trip"**

TRIP 3D is a restrained, authored Chinese cartography workspace. A neutral limestone-gray terrain-and-hillshade canvas carries the route; #171c1f-class instrument surfaces make the controls legible without competing for the first glance. The route-orange line and direct state transition establish the only urgent visual voice.

The product feels like a dependable field instrument: compact rounded controls, short Chinese labels, ordered row content, and progressive disclosure let planning, terrain, time, and weather remain facets of one trip. Frosted material is reserved for information anchored to the map, so geographic context survives without turning the interface into glass decoration.

**Key Characteristics:**
- Map-first operating canvas with two fixed top instruments, a destination rail, one unified right dock, and movable contextual instruments.
- Neutral terrain/hillshade canvas, near-black instruments, and warm-paper contextual surfaces rather than dashboard-card density.
- Restrained Chinese system typography with compact metadata and tabular numerical detail.
- Orange route selection, blue weather information, dark secondary selections, and direct truthful status colors.
- Rounded, familiar controls; dense information remains in rows, sheets, and drawers.

## Colors

The palette is terrain-neutral and high-contrast: ink and paper establish operational clarity, while route orange is rare enough to keep travel movement and the primary action unmistakable.

### Primary
- **Route Ember:** Carries the active route, direct map selection, the global Plan/Analyze state, and an enabled primary action.

### Secondary
- **Weather Blue:** Identifies weather-specific links and rain context without competing with route selection.
- **Verified Green:** Communicates success only when a state is actually successful.
- **Field Warning:** Communicates a limitation or warning without impersonating the primary route action.

### Neutral
- **Cartographic Ink:** Anchors text and dark route-mode control.
- **Instrument Charcoal:** #171c1f-class surfaces form the fixed top chrome, narrow rail, unified right dock, Route Summary, and Analyze profile.
- **Terrain Paper:** #eef0ee-class neutral limestone gray is the low-contrast topographic canvas; it stays cooler and quieter than the warm inspector paper and active route.
- **Quiet Ink:** Holds metadata and secondary explanation at a lower visual volume.
- **Panel Paper:** #f6f4ee forms compact inspector surfaces and stable drawers.
- **Strong Paper:** Keeps editable fields and row interiors opaque and readable.
- **Fine Boundary / Strong Boundary:** Separate adjacent operational regions without turning the map surface into a grid.

**The One Route Voice Rule.** Route orange is reserved for the active route, direct selection, the global Plan/Analyze state, and an enabled primary action; secondary route and date choices use dark selected states instead of decorative orange.

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

The map is the continuous working surface. At 1024px and above, brand/search stays fixed at top-left and Plan/Analyze stays fixed at top-center. A narrow left rail owns only Plan, Route Library, and Weather destinations plus a quiet More utility. One compact right dock owns expandable Save/Share, Layers, Zoom, and Fit; no separate top-right action island or duplicate Weather trigger remains.

Desktop contextual information uses one shared floating layout system. The 328px Inspector host, Route Summary/Elevation Profile, and marker Weather card may be moved and resized; navigation and map-operation chrome never drifts. Their live occupied rectangles feed shared safe-area variables and route-fit padding so the mode switch, rail, dock, hint, route endpoints, and one another remain unobstructed. Session-only versioned layout state is clamped on viewport or content change and reset from More.

On desktop, Analyze is map-first: the route corridor, current position, truthful terrain status, and dark Elevation Profile instrument remain visible together. Route Summary and Elevation Profile share one saved placement family so switching state reads as a continuous instrument rather than a new dashboard.

Below 1024px, free drag and resize are disabled. Map gestures retain priority while the Inspector continues through the existing peek/half/full bottom sheet and the lower information layer keeps 10px insets, 44px targets, and bottom-navigation clearance. This responsive state never reuses stale desktop coordinates.

**The Continuous Map Rule.** Chrome floats above the map with a visible geographic margin or collapses into an analysis layer, map anchor, side context, or shared sheet according to task. No open state may fragment the trip into competing dashboard columns, form a rigid four-edge frame, or turn the map into background decoration.

### Analyze hierarchy and route terrain seam

Analyze starts with only what is needed to read the journey: map, Route Ember corridor, elevation profile, current position, and one core value. `路线详情`按需展示路线、高程、坡度与可用状态；内部数据来源或参数不进入用户可见层级。The dark profile continues the same lower information territory as Plan's Route Summary; it is not an additional card layer.

Route Ember is the sole strong visual on the working map. Terrain outside the corridor stays low contrast; terrain detail may progressively resolve along the route. Future P6 terrain availability enters through one small truthful route-terrain status capsule (for example, `路线地形 · 正在补齐`) and corridor refinement only. It must not introduce a separate terrain-management destination or invent coverage, completion, weather, dates, risk, or analytics.

## Elevation & Depth

The system is flat by default. Ordinary rows, fields, segmented controls, and list containers use warm paper, boundary lines, and grouped spacing rather than lift. The terrain canvas supplies most depth; restrained shadows merely separate near-black instruments, warm-paper inspectors, and the lower profile from variable geography.

### Shadow Vocabulary
- **Inspector lift** (`0 18px 50px rgba(25,24,20,.18)`): Separates the warm-panel inspector from variable terrain without giving its internal rows lift.
- **Instrument lift** (`0 6px 18px rgba(0,0,0,.2)`): Separates #171c1f-class islands, narrow rail, and map controls from variable terrain.
- **Lower-edge lift:** Plan Route Summary uses `0 8px 24px rgba(0,0,0,.18)`; Analyze Elevation Profile retains `0 12px 32px rgba(0,0,0,.2)`. Neither adds a second card hierarchy.
- **Weather-card lift** (`0 12px 32px rgba(6,10,12,.22)`): Keeps the marker-anchored weather outlet readable without theatrical depth.

**The Flat-First Rule.** Use elevation only to establish a floating map context; do not add shadows to ordinary content rows or invent a card hierarchy.

**The Contextual Frost Rule.** Blur belongs exclusively to map-anchored information and dark/light map controls, with opaque fallbacks when reduced transparency is requested.

## Motion & Direct Manipulation

Desktop movable instruments use Pointer Events and pointer capture. A 9px hysteresis separates press from drag; the element preserves the original grab offset and tracks the pointer 1:1 after intent is established. Bounds use progressive rubber-band resistance during movement and a final viewport/safe-area clamp on release. The active instrument comes to front.

Release settles with an interruptible critically damped spring from the current presentation value, without decorative bounce. Resize shares the same lifecycle and obeys per-instrument minimum and maximum sizes. Buttons, close/back actions, fields, links, and fixed chrome never initiate drag. `prefers-reduced-motion: reduce` skips the spring and uses only a short opacity cross-fade or immediate state change.

## Shapes

Forms are rounded, compact, and repeatable. Use the 8/10/12/14px geometry deliberately: 8px for internal actions and fields, 10px for compact context, 12px for desktop instruments and the lower summary/profile, and 14px for warm-paper inspectors. Mobile retains the same family with 10px screen insets; it does not introduce oversized pills. Journey rows remain square within their shared container so a route reads as a sequence rather than a grid of cards.

**The Grouped Row Rule.** Reserve rounded outer corners for a meaningful group; internal rows divide with fine lines and selection rules instead of acquiring individual card silhouettes.

## Components

### Command buttons
- **Primary continuation:** Route Ember is the active Plan/Analyze state and an enabled direct route action; white text, 42px desktop height, and 8px internal radius. Hover darkens the orange; pressed state scales to 0.97.
- **Secondary and icon actions:** 42px transparent actions inside #171c1f instruments, split only by short fine white lines where grouped. Hover adds one restrained white veil; focus uses the route-orange 2px outline.
- **State:** Buttons expose hover, focus-visible, active, disabled, and selected treatment. Motion is limited to color/border at 140–180ms and press-scale at 100ms.

### Desktop fixed instruments
- **Shape:** Brand/search is a 50px-tall, 12px-radius dark instrument; the centered stage switch is 48px tall. Save and Share move into the expandable top segment of the right map dock.
- **State:** The stage switch uses Route Ember for the selected state and muted text for the alternative. Search stays 238px by default and strengthens its field boundary without moving its island.

### Plan / Analyze and segmented controls
- **Style:** The Plan/Analyze control is a 48px, 12px-radius #171c1f instrument with 3px inner spacing and 38px, 8px segments. Route mode and Weather date choices use dark selected states on warm paper so orange remains a map and global-stage signal.
- **State:** The active choice uses Route Ember plus white text; inactive states are muted, and disabled Analyze remains visibly unavailable until the route is ready.

### Navigation rail and map controls
- **Style:** Desktop uses a narrow 48px, 12px-radius dark destination rail at the left and a compact 10px-radius unified dock at the right. The dock groups expandable Save/Share, Layers, Zoom, and Fit with 40px actions.
- **State:** Active work uses a two-pixel Route Ember rule and orange icon rather than a filled block. On mobile the rail disappears and its destinations re-enter through the header or lower sheet.

### Map context and controls
- **Style:** Planner shows one 36px light contextual instruction pill rather than a persistent map context card; map-operation controls sit in a 10px-radius dark group with 42px buttons.
- **State:** Map control hover adds only a quiet translucent light fill. The instruction appears only while planning needs it and never reads as a general card surface.

### Route Summary / Elevation Profile
- **Style:** Plan uses a content-fitted 78px default dark Route Summary with no decorative orange baseline; Analyze continues from its layout family with the dark Elevation Profile, orange route trace, cursor marker, and `返回规划` action. Both provide low-noise drag and resize affordances on desktop.
- **State:** Selected rows use both a thin Route Ember leading rule and a 6% orange fill. On mobile, the same content becomes one inset lower layer rather than duplicate cards.

### First-use route guidance
- **Style:** Guidance follows the map cursor with one short action label; the duplicate step strip and top-center Start Planning action are absent.
- **State:** Before the second point, at most the map hint and Route Summary status express the empty state. Both read shared safe areas and never block the route endpoint.

### Weather card
- **Style:** A marker-anchored 248px card with a 14px radius, one restrained shadow, and a light 90% surface on 2D maps or dark 82% surface on 3D terrain.
- **State:** It participates in desktop drag, resize, bring-to-front, collision avoidance, and route-fit safe areas; it supports dismissal and switches to an opaque surface for reduced-transparency preferences.

### Settings and menus
- **Style:** Plan, Library, Weather, and Share reuse one 316–336px warm-paper Inspector host with a 58px #1a2023 drag-region header, no pale outer shell, no nested card borders, and one visually quiet scroll context. Overflow menus remain small, anchored, and grouped by meaning.
- **State:** Destination access uses the smallest contextual rail, overflow, anchor, or drawer that keeps the map usable; no one control placement is globally mandatory. Planning, weather, saving, sharing, export, settings, and Admin each retain a discoverable single-purpose entry without competing with default Analyze. Planning orders naming, route mode and one continuous waypoint sequence, disclosed import/edit/export tools, then its save action. Weather reads the live route only, provides Today/Tomorrow/custom-date selection, automatically uses representative route points, and presents truthful forecast or ERA5/archive availability.

## Do's and Don'ts

### Do:
- **Do** keep the map and route as the default visual proof of the product.
- **Do** use Route Ember only for movement, explicit selection, and the one primary action.
- **Do** keep high-frequency controls compact at 40px on desktop and reachable at 44px touch targets on mobile.
- **Do** preserve the fixed brand/mode hierarchy, destination rail, unified right dock, and Route Summary→Elevation Profile spatial continuity.
- **Do** let neutral limestone-gray hillshade and contour texture carry the visual field while Route Ember remains the sharp route signal.
- **Do** use frosted dark or light material only for map-anchored context, with an opaque reduced-transparency fallback.
- **Do** group itinerary, settings, and metrics into lined rows with progressive disclosure.

### Don't:
- **Don't** turn the workspace into a generic AI dashboard, feature-wall card grid, or decorative metric wall.
- **Don't** use pervasive glass, glow, gradient identity, or invented smart claims.
- **Don't** promote inspectors, terrain status, or profile metrics into floating dashboard cards that cover the route.
- **Don't** give every field, metric, or itinerary segment its own rounded card.
- **Don't** use hover lift, bounce, broad `transition: all`, or decorative entrance sequences.
- **Don't** silently hide unavailable, stale, or provider-limited trip information behind polished visual treatment.
