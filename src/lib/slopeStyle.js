// Route visual style helpers — pure module (TDD-covered).
// Slope bands follow Caltopo conventions: <5° green / 5-15° yellow /
// 15-25° orange / >25° red. Downhill uses absolute slope.

export const SLOPE_COLORS = Object.freeze({
  green: [0.30, 0.69, 0.31],
  yellow: [0.97, 0.82, 0.33],
  orange: [1, 0.30, 0],
  red: [0.83, 0.18, 0.18],
})

export const ARROW_SPACING_M = 300

export function slopeColorOf(deg) {
  if (!Number.isFinite(deg)) return [...SLOPE_COLORS.green]
  const a = Math.abs(deg)
  if (a < 5) return [...SLOPE_COLORS.green]
  if (a < 15) return [...SLOPE_COLORS.yellow]
  if (a < 25) return [...SLOPE_COLORS.orange]
  return [...SLOPE_COLORS.red]
}

// distance tick spacing: <8km → 1km; 8-40km → 5km; >40km → 10km
export function tickIntervalM(distanceM) {
  if (distanceM < 8000) return 1000
  if (distanceM <= 40000) return 5000
  return 10000
}

// slope angle in degrees between two sampled path points
export function segmentSlopeDeg(riseM, runM) {
  if (!Number.isFinite(riseM) || !Number.isFinite(runM) || runM <= 0) return 0
  return (Math.atan(riseM / runM) * 180) / Math.PI
}
