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

// Route-specific latest-intent gate. It keeps only one pending geometry,
// cancels a different active request, and starts no more than one dispatch in
// each interval. It deliberately knows nothing about UI or provider retries.
export function createSnapRequestGate({
  dispatch,
  minIntervalMs = 1100,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let lastDispatchAt = -Infinity
  let pending = null
  let active = null

  const cancel = () => {
    if (pending) clearTimer(pending.timer)
    pending = null
    active?.controller.abort()
    active = null
  }

  const start = async (entry) => {
    if (pending !== entry) return
    pending = null
    lastDispatchAt = now()
    const controller = new AbortController()
    active = { identity: entry.intent.identity, controller }
    try {
      await dispatch(entry.intent, { signal: controller.signal })
    } finally {
      if (active?.controller === controller) active = null
    }
  }

  return {
    schedule(intent) {
      if (!intent?.identity) throw new TypeError('snap request identity required')
      if (pending?.intent.identity === intent.identity || active?.identity === intent.identity) return false
      if (pending) clearTimer(pending.timer)
      active?.controller.abort()
      active = null
      const wait = Math.max(0, minIntervalMs - (now() - lastDispatchAt))
      const entry = { intent, timer: null }
      entry.timer = setTimer(() => start(entry), wait)
      pending = entry
      return true
    },
    cancel,
    stats() { return { pending: pending?.intent.identity ?? null, active: active?.identity ?? null, lastDispatchAt } },
  }
}
