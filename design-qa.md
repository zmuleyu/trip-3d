# TRIP 3D Map-First Planning Surface — Design QA

## Comparison target and normalization

- Source visual truth: `C:\Users\Admin\.codex\generated_images\01a04847-2a4b-7183-bb94-b21fc4bcab93\exec-f298b9ff-aa20-48aa-b3e6-2629a5de03ba.png` at 1672 × 941 px. The target and its annotations were frozen and inspected before implementation; this pass followed the explicit instruction not to reopen or regenerate it.
- Desktop implementation: `.codex/evidence/map-first/desktop-confirmed-summary.png` at 1440 × 900 px, 1440 × 900 CSS px, device scale 1.
- Mobile implementation: `.codex/evidence/map-first/mobile-confirmed-sheet.png` at 390 × 844 px, 390 × 844 CSS px, device scale 1.
- State: Plan with one shared route, right-anchored planning Inspector, horizontal map dock, and a route-line selection exposing the on-demand Route Summary. Mobile uses the same route with the Inspector in its half-height bottom-sheet state.
- Normalization: the source raster and implementation viewport differ in aspect ratio, so comparison uses the app-owned map canvas and relative anchors rather than browser chrome or a forced pixel stretch. No device frame is present.

## Findings

No actionable P0, P1, or P2 issue remains.

### Required fidelity surfaces

- Fonts and typography: the implementation keeps the canonical Segoe UI / PingFang SC / Microsoft YaHei system stack, compact operational weights, readable metadata, and token-driven compact/standard/large reflow. No text is scaled with `transform`.
- Spacing and layout rhythm: the map remains the primary surface; the four-action dock is a compact right-aligned horizontal instrument; the 360px Inspector sits below it and touches the right edge only while anchored; the selected Route Summary occupies the lower information territory without creating a dashboard column.
- Colors and tokens: Instrument Charcoal, warm paper, neutral terrain, and Route Ember remain the only strong hierarchy. New controls reuse repository tokens and maintain reduced-transparency and increased-contrast fallbacks.
- Image and asset fidelity: no new raster, illustration, placeholder, CSS drawing, or handcrafted icon was introduced. The visible geography remains the live MapLibre terrain/basemap and all new controls reuse the existing icon system.
- Copy and content: labels remain concise and action-oriented. Search provider/source language, local-only density preference, route roles, unavailable weather, distance, and duration stay truthful.

## Comparison history

1. **P1 — route line click could fall through to blank-map add.** The first desktop interaction missed the narrow rendered line and created an unintended waypoint. Fixed by querying a 6px pointer / 10px touch hit box before blank-map add. Post-fix evidence: `.codex/evidence/map-first/desktop-confirmed-summary.png`; selecting the rendered second leg opens `P2 → P3` while waypoint count remains three.
2. **P1 — the unique rail More menu opened behind the anchored Inspector.** Moved the desktop menu beside the left rail. Post-fix evidence confirmed every global action was visible and the Settings action was operable.
3. **P2 — mobile DOM reflow could clamp saved desktop coordinates.** Opening Settings and changing density at 390px triggered the layout observer even though free layout was disabled, turning the next desktop Inspector into an `x:88 / 316px` detached card. The observer now preserves desktop state while disabled. The red test reproduced that exact clamp, the green test retains the 360px right anchor, and `.codex/evidence/map-first/desktop-roundtrip.png` records `data-fluid-anchored="true"` after the desktop → 390 Settings reflow → desktop loop.
4. **P2 — opening the Inspector or Route Summary could leave route endpoints under new occupied areas.** The panel and summary now refresh shared safe areas before fitting. Post-fix desktop evidence keeps both endpoints visible around the anchored Inspector and lower summary.
5. **P1 — route segment identity followed waypoint chords instead of the rendered path.** Selection now projects the click onto the current rendered points and resolves it through the same leg-distance boundaries used by the summary. The final desktop evidence uses three waypoints and confirms the clicked curved leg reports the correct adjacent waypoint pair without adding a waypoint.

## Interaction and responsive evidence

- Explicit search submit retained the Nominatim-first / Photon-fallback gate. Selecting the result focused MapLibre before any route role was assigned; the compact popover displayed place/admin/category once and remained keyboard operable.
- Desktop Inspector: right anchored at 360px, 1:1 titlebar drag excluding controls, 9px hysteresis, pointer capture, rubber-band bounds, critically damped release, interruptible motion, container resize with content reflow, and double-click reset were exercised.
- Density: large resolved to 16px, compact to 13px / 40px controls, and standard remained the final local preference; no scale transform was present. Mobile compact controls retain the 44px touch floor.
- Route selection: a three-waypoint snapped route-line selection showed the correct shared leg summary; a repeated selection/close path hides it; route reconciliation tests cover removed and reordered identities. Analyze continues to use the existing elevation profile instead of rendering the Plan summary.
- Map dock: Layers, Fit, Zoom out, and Zoom in were all exercised; no global ellipsis remains in the dock.
- Mobile: `.codex/evidence/map-first/mobile-confirmed-sheet.png` shows the horizontal four-action dock, readable sheet, attribution clearance, four-item bottom rail including More, and no free drag/resize (`data-fluid-enabled="false"`). `.codex/evidence/map-first/mobile-search-results.png` shows the search popover without horizontal overflow.
- Browser console: no warning- or error-level entries after the final desktop/390px pass.

## Mechanical evidence

- Focused restored-candidate tests: 106 passed across the changed UI modules.
- `npm run test:changed`: 58 files / 410 tests passed.
- Differential post-gate fix: the new mobile-mutation regression failed with the observed `760/328 → 88/316` clamp, then FluidLayout passed 16/16 after the disabled-observer guard. Browser confirmation repeated desktop → 390 Settings density reflow → desktop and restored `right:0 / 360px`, `data-fluid-anchored="true"` with all three waypoints intact.
- Impeccable detector ran once over changed UI paths. It reported inherited stylesheet advisories and no newly introduced P0–P2 blocker; sidecar drift was not repaired.
- `npm run acceptance` completed the v0.5.0 build and captured its desktop/390 states. Windows then reported `EBUSY` while removing a temporary Chromium dictionary after the gate had printed completion; the exact task-owned temporary directory was removed once unlocked. The later narrow FluidLayout guard was revalidated only through its focused test and original browser symptom, as required by the post-acceptance differential rule.

final result: passed
