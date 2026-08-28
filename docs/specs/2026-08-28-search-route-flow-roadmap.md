---
title: Search and route intent flow roadmap
status: active
updated: 2026-08-28
scope: R1 search and route intent
---

# Search and route intent flow roadmap

## R1 — active and frozen

Desktop and 390px use one shared search state. Every result shows its place name,
city/district/province context, and category without relying on hover or a title
attribute. Selecting a result enters `PlaceSelection`; it does not change the
route until the user explicitly chooses **设为起点**, **设为终点**, **添加途经点**,
or **仅查看**.

After a role is chosen, the existing single-trip route flow calculates one route
and reports a plain-language state: calculating, available, or a straight-line
fallback. A fallback explicitly says that it has no duration and offers the
smallest recovery action.

## Later dependencies (not part of R1)

- Fully decouple routing and DEM work.
- Add route results and alternatives.
- Improve mobile gestures and accessibility beyond this flow.
- Productionize providers.
