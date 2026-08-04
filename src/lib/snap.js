// Snap helpers: geometry joining + cache keys. Pure module.

// Concatenate per-segment geometries into one polyline, dropping duplicate seam points.
export function joinGeometries(segments) {
  const out = []
  for (const seg of segments) {
    if (!seg?.length) continue
    for (const pt of seg) {
      const last = out[out.length - 1]
      if (last && last[0] === pt[0] && last[1] === pt[1]) continue
      out.push(pt)
    }
  }
  return out
}

// Cache key: provider + profile + direction-sensitive canonical coords (5dp ≈ 1m).
export function snapCacheKey(provider, profile, a, b) {
  return `${provider}:${profile}:${a.lon.toFixed(5)},${a.lat.toFixed(5)}>${b.lon.toFixed(5)},${b.lat.toFixed(5)}`
}
