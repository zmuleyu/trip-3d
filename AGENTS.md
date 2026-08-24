# TRIP 3D Delivery Rules

## Product invariants

- Keep one trip model across 2D, 3D, time, terrain, weather, save, and share states.
- Keep the map and route as the primary working surface; controls must recede or reflow instead of covering critical geography.
- Preserve truthful local-save and provider-availability states. Do not invent dates, weather, coverage, or synchronization.
- `PRODUCT.md` owns product behavior and `DESIGN.md` owns visual and interaction decisions.

## Visual delivery fast path

1. Freeze one exact visual target and its annotations before implementation. After selection, do not generate more concepts unless the user requests a revision.
2. Use one `/goal` only when persistence helps. One goal owns one terminal UI outcome, not a roadmap.
3. Implement the complete affected surface in one batch. Preserve existing route, weather, share, storage, and responsive contracts.
4. Run one combined visual evidence round covering desktop and 390px mobile. Fix all P0–P2 findings in one batch, then perform at most one confirmation round.
5. Reuse unchanged evidence. Do not repeat screenshots, builds, tests, or detector scans after changes that cannot affect them.
6. Keep only final desktop/mobile evidence and one screenshot for each materially changed workflow. Remove intermediate captures before commit.

## Validation

- Run focused tests for changed UI modules; use the full suite only when shared behavior makes it necessary.
- Run `npm run build` once on the final candidate before release.
- Run the Impeccable detector only on changed UI paths and act on newly introduced warnings. Do not turn inherited stylesheet advisories into a broad cleanup task.
- Browser acceptance is one desktop pass and one 390px pass covering the primary route flow, changed inspector states, and console errors.
- GitHub Actions are not part of the release gate unless the user explicitly requests them or branch protection requires them.

## Release

- Use a `codex/` branch and stage only task-owned paths.
- Bump patch for compatible UI fixes, minor for new user-facing capabilities, and major only for breaking stored-route or shared-link changes.
- Commit, push, PR, merge, and Cloudflare Pages deployment remain separate authority gates.
- For an authorized Pages release, deploy the exact final `dist` candidate with the real full commit SHA and verify the immutable deployment URL plus `https://trip-3d.pages.dev` once.
