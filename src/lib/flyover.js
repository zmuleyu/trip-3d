// Flyover camera path math — pure, TDD'd. Recording lives in main.js.

// Uniform arc-length resample of a world-space polyline [{x, z}, ...].
export function resamplePath(pts, n) {
  if (!pts || pts.length < 2) return []
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z))
  }
  const total = cum[cum.length - 1]
  if (total <= 0) return []
  const out = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total
    while (j < pts.length - 2 && cum[j + 1] < d) j++
    const seg = cum[j + 1] - cum[j] || 1
    const t = (d - cum[j]) / seg
    out.push({
      x: pts[j].x + (pts[j + 1].x - pts[j].x) * t,
      z: pts[j].z + (pts[j + 1].z - pts[j].z) * t,
    })
  }
  return out
}

// Recording duration: distance / speed, clamped.
export function flyoverDuration(totalDistM, { mPerSec = 400, minS = 12, maxS = 60 } = {}) {
  return Math.min(maxS, Math.max(minS, totalDistM / mPerSec))
}

// Camera frame at path index i: hover `height` above ground, look at a lifted
// point `lookAhead` samples forward (clamped at the end).
export function cameraFrame(path, i, groundY, { height = 2.5, lookAhead = 2, targetLift = 0.4 } = {}) {
  const p = path[i]
  const j = Math.min(i + lookAhead, path.length - 1)
  const q = path[j]
  return {
    pos: { x: p.x, y: groundY(p.x, p.z) + height, z: p.z },
    target: { x: q.x, y: groundY(q.x, q.z) + targetLift, z: q.z },
  }
}
