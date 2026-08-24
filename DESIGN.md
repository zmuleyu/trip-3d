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
- Map-first operating canvas with slim edge chrome and a single filled route action.
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

The map is the continuous working surface. On desktop, a 60px top command bar, a 52px left tool rail, edge-attached map controls, and a 58px collapsed journey summary leave the map visually dominant. Expanded itinerary and settings occupy a right-side drawer of up to 390px rather than re-centering the map.

At 1080px the secondary weather and layer triggers recede. At 720px and below, the command bar becomes 56px, the left rail becomes a 58px bottom navigation strip, and the itinerary becomes one bottom sheet with peek (96px), working-half, and full states. Mobile preserves the map behind the sheet, surfaces only two summary metrics, and keeps primary map operations reachable above it.

**The Continuous Map Rule.** Chrome attaches to the map edge or collapses into the shared sheet; no open state may fragment the trip into competing dashboard columns.

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

### Expanding search
- **Shape:** A 40px search trigger grows into a 270px, 22px-radius text field only while focused.
- **State:** The field expands from its left origin over 150ms and becomes a near-opaque dark surface on focus; placeholder text remains muted but legible.

### View switch and segmented controls
- **Style:** Compact 2–3px inner padding inside an 18–20px rounded group; the active segment receives a pale translucent fill and white text.
- **State:** The active choice is expressed by both fill and text contrast, never color alone.

### Navigation rail
- **Style:** Desktop is a 52px dark frosted vertical rail with 40px tools and focus/hover labels; mobile becomes a light 58px bottom strip with persistent text labels.
- **State:** Active planning uses route orange on desktop and route-orange type plus a restrained pale fill on mobile.

### Map context and controls
- **Style:** Map labels use a 10px-radius light frosted context card; map-operation controls sit in a 14px-radius dark frosted group with 40px buttons.
- **State:** Map control hover adds only a quiet translucent light fill. Context stays anchored at the map edge and never reads as a general card surface.

### Journey summary and itinerary rows
- **Style:** The collapsed desktop summary is a 58px, 16px-radius frosted strip; expanded content becomes a 16px-radius opaque right drawer. Itinerary rows are 58px minimum, use 10px padding, and live inside a shared 12px outlined list.
- **State:** Selected rows use both a thin Route Ember leading rule and a 6% orange fill. Compact tabular metrics make comparison fast; mobile shows a two-metric summary before progressive disclosure.

### Weather card
- **Style:** A marker-anchored 248px card with a 14px radius, 12px blur, fine border, one restrained shadow, and a light 90% surface on 2D maps or dark 82% surface on 3D terrain.
- **State:** It opens and moves with 130ms opacity/transform feedback, supports dismissal, and switches to an opaque surface for reduced-transparency preferences.

### Settings and menus
- **Style:** Opaque paper drawers and menus use 12–16px rounded group boundaries, 14–18px section spacing, fine dividers, and 40–42px editable controls.
- **State:** Dense settings remain a single ordered drawer; advanced options are contained rather than displayed as a feature-card wall.

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
