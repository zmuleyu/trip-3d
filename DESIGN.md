---
name: TRIP 3D
description: A restrained Chinese-first cartographic workspace where one trip stays on one map.
colors:
  ink: "#1f2428"
  ink-soft: "#5f696f"
  instrument: "#161b1e"
  paper: "#f7f7f4"
  terrain-paper: "#f4f0e6"
  context-paper: "#f7f5ef"
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
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.action}"
    height: "40px"
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
    padding: "6px"
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
    height: "58px"
  stage-switch:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.paper-strong}"
    rounded: "12px"
    padding: "3px"
    height: "52px"
  elevation-profile:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.paper-strong}"
    rounded: "12px"
    padding: "0 18px"
---

# Design System: TRIP 3D

## Overview

**Creative North Star: "The Map Is the Trip"**

TRIP 3D is a restrained, authored Chinese cartography workspace. A warm terrain-and-hillshade canvas carries the route; #161b1e-class instrument surfaces make the controls legible without competing for the first glance. The route-orange line and direct state transition establish the only urgent visual voice.

The product feels like a dependable field instrument: compact rounded controls, short Chinese labels, ordered row content, and progressive disclosure let planning, terrain, time, and weather remain facets of one trip. Frosted material is reserved for information anchored to the map, so geographic context survives without turning the interface into glass decoration.

**Key Characteristics:**
- Map-first operating canvas with three desktop tool islands, a narrow rail, and a single continuous lower information layer.
- Warm terrain/hillshade canvas, near-black instruments, and warm-paper contextual surfaces rather than dashboard-card density.
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
- **Cartographic Ink:** Anchors text and dark route-mode control.
- **Instrument Charcoal:** #161b1e-class surfaces form the desktop three-island chrome, narrow rail, map zoom group, and Analyze profile.
- **Terrain Paper:** The warm, low-contrast topographic canvas; it stays quieter than its terrain corridor and active route.
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

The map is the continuous working surface. On desktop the pinned Plan/Analyze world uses three floating top instruments—brand/search at left, Plan/Analyze state at center, and save/share/more at right—plus a narrow left rail, a compact right zoom group, and one lower information layer. These islands are fixed visual hierarchy for the operating workspace; their contents remain contextual and inspectors reflow instead of competing with the geography.

On desktop, Analyze is map-first: the route corridor, current position, truthful terrain status, and dark Elevation Profile band remain visible together. The profile owns the lower edge in Analyze; Route Summary uses the same lower-edge territory in Plan, so switching state reads as a continuous instrument rather than a new dashboard. At 1080px, secondary weather and layer triggers recede before the map loses working area.

At 720px and below, map gestures retain priority. The header condenses to brand, the Plan/Analyze switch, and one 44px more target; save/share and contextual desktop tools move behind that entry. The lower layer becomes a shared 10px-inset Route Summary or Elevation Profile sheet, with 44px targets and enough map visible for route orientation. It does not reproduce desktop chrome mechanically.

**The Continuous Map Rule.** Chrome floats above the map with a visible geographic margin or collapses into an analysis layer, map anchor, side context, or shared sheet according to task. No open state may fragment the trip into competing dashboard columns, form a rigid four-edge frame, or turn the map into background decoration.

### Analyze hierarchy and route terrain seam

Analyze starts with only what is needed to read the journey: map, Route Ember corridor, elevation profile, current position, and one core value. `路线详情`按需展示路线、高程、坡度与可用状态；内部数据来源或参数不进入用户可见层级。The dark profile continues the same lower information territory as Plan's Route Summary; it is not an additional card layer.

Route Ember is the sole strong visual on the working map. Terrain outside the corridor stays low contrast; terrain detail may progressively resolve along the route. Future P6 terrain availability enters through one small truthful route-terrain status capsule (for example, `路线地形 · 正在补齐`) and corridor refinement only. It must not introduce a separate terrain-management destination or invent coverage, completion, weather, dates, risk, or analytics.

## Elevation & Depth

The system is flat by default. Ordinary rows, fields, segmented controls, and list containers use warm paper, boundary lines, and grouped spacing rather than lift. The terrain canvas supplies most depth; restrained shadows merely separate near-black instruments, warm-paper inspectors, and the lower profile from variable geography.

### Shadow Vocabulary
- **Floating map context** (`0 10px 30px rgba(18, 24, 28, 0.16)`): Used by drawers and elevated map-anchored context only.
- **Instrument lift** (`0 6px 18px rgba(0,0,0,.2)`): Separates #161b1e-class islands, narrow rail, and map controls from variable terrain.
- **Lower analysis lift** (`0 12px 32px rgba(0,0,0,.2)`): Holds Route Summary or Elevation Profile at the lower edge without creating a second card hierarchy.
- **Weather-card lift** (`0 12px 32px rgba(6,10,12,.22)`): Keeps the marker-anchored weather outlet readable without theatrical depth.

**The Flat-First Rule.** Use elevation only to establish a floating map context; do not add shadows to ordinary content rows or invent a card hierarchy.

**The Contextual Frost Rule.** Blur belongs exclusively to map-anchored information and dark/light map controls, with opaque fallbacks when reduced transparency is requested.

## Shapes

Forms are rounded, compact, and repeatable. Use the 8/10/12/14px geometry deliberately: 8px for internal actions and fields, 10px for compact context, 12px for desktop instruments and the lower summary/profile, and 14px for warm-paper inspectors. Mobile retains the same family with 10px screen insets; it does not introduce oversized pills. Journey rows remain square within their shared container so a route reads as a sequence rather than a grid of cards.

**The Grouped Row Rule.** Reserve rounded outer corners for a meaningful group; internal rows divide with fine lines and selection rules instead of acquiring individual card silhouettes.

## Components

### Command buttons
- **Primary continuation:** Route Ember is the active Plan/Analyze state and direct route action; white text, 38–40px desktop height, and 8px internal radius. Hover darkens the orange; pressed state scales to 0.97.
- **Secondary and icon actions:** 40px transparent actions inside #161b1e instruments, split by fine white lines where grouped. Hover adds one restrained white veil; focus uses the route-orange 2px outline.
- **State:** Buttons expose hover, focus-visible, active, disabled, and selected treatment. Motion is limited to color/border at 140–180ms and press-scale at 100ms.

### Desktop instrument islands
- **Shape:** Brand/search, stage switch, and route actions are 52px-tall, 12px-radius dark instruments. Brand/search stays left; Plan/Analyze remains centered; save/share/more remains right.
- **State:** The stage switch uses Route Ember for the selected state and muted text for the alternative. Search stays 238px by default and strengthens its field boundary without moving its island.

### Plan / Analyze and segmented controls
- **Style:** The Plan/Analyze control is a 12px-radius #161b1e instrument with 3px inner spacing and 8px segments. Route mode inside the inspector follows the same compact grid logic on warm paper.
- **State:** The active choice uses Route Ember plus white text; inactive states are muted, and disabled Analyze remains visibly unavailable until the route is ready.

### Navigation rail and map controls
- **Style:** Desktop uses a narrow 48px, 12px-radius dark rail at the left and a compact 10px-radius dark zoom group at the right. Their 38–40px actions keep the map's terrain readable.
- **State:** Active work uses a one-pixel Route Ember rule and orange icon rather than a filled block. On mobile the rail disappears and its destinations re-enter through the header or lower sheet.

### Map context and controls
- **Style:** Map labels use a 10px-radius light frosted context card; map-operation controls sit in a 14px-radius dark frosted group with 40px buttons.
- **State:** Map control hover adds only a quiet translucent light fill. Context stays anchored at the map edge and never reads as a general card surface.

### Route Summary / Elevation Profile
- **Style:** Plan uses a dark lower Route Summary with a subtle orange baseline; Analyze replaces it in-place with the dark Elevation Profile, orange route trace, cursor marker, and `返回规划` action. The layer spans the desktop lower edge with 12px corners and stays a single continuous information band.
- **State:** Selected rows use both a thin Route Ember leading rule and a 6% orange fill. On mobile, the same content becomes one inset lower layer rather than duplicate cards.

### First-use route guidance
- **Style:** Guidance follows the map cursor with one short action label while a compact step strip sits above the summary: `设置起点 → 添加途经点 → 确认路线`.
- **State:** It appears only before the second point, updates immediately after the first click, offers `跳过引导`, and never blocks the central map or impersonates a modal.

### Weather card
- **Style:** A marker-anchored 248px card with a 14px radius, 12px blur, fine border, one restrained shadow, and a light 90% surface on 2D maps or dark 82% surface on 3D terrain.
- **State:** It opens and moves with 130ms opacity/transform feedback, supports dismissal, and switches to an opaque surface for reduced-transparency preferences.

### Settings and menus
- **Style:** Every desktop inspector is a narrow 340px warm-paper contextual surface with a #1a2023 header cap, 14px outer boundary, fine dividers, and 40–44px controls. Overflow menus remain small, anchored, and grouped by meaning.
- **State:** Destination access uses the smallest contextual rail, overflow, anchor, or drawer that keeps the map usable; no one control placement is globally mandatory. Planning, weather, saving, sharing, export, settings, and Admin each retain a discoverable single-purpose entry without competing with default Analyze. Planning orders naming, route mode and one continuous waypoint sequence, disclosed import/edit/export tools, then its save action. Weather reads the live route only, provides Today/Tomorrow/custom-date selection, automatically uses representative route points, and presents truthful forecast or ERA5/archive availability.

## Do's and Don'ts

### Do:
- **Do** keep the map and route as the default visual proof of the product.
- **Do** use Route Ember only for movement, explicit selection, and the one primary action.
- **Do** keep high-frequency controls compact at 40px on desktop and reachable at 44px touch targets on mobile.
- **Do** preserve the desktop three-island hierarchy, narrow rail, and the Route Summary→Elevation Profile lower-edge continuity.
- **Do** let warm hillshade and contour texture carry the visual field while Route Ember remains the sharp route signal.
- **Do** use frosted dark or light material only for map-anchored context, with an opaque reduced-transparency fallback.
- **Do** group itinerary, settings, and metrics into lined rows with progressive disclosure.

### Don't:
- **Don't** turn the workspace into a generic AI dashboard, feature-wall card grid, or decorative metric wall.
- **Don't** use pervasive glass, glow, gradient identity, or invented smart claims.
- **Don't** promote inspectors, terrain status, or profile metrics into floating dashboard cards that cover the route.
- **Don't** give every field, metric, or itinerary segment its own rounded card.
- **Don't** use hover lift, bounce, broad `transition: all`, or decorative entrance sequences.
- **Don't** silently hide unavailable, stale, or provider-limited trip information behind polished visual treatment.
