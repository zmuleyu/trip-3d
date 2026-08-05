// Solar position — NOAA-style approximation (~0.5° accuracy, fine for lighting).
// azimuth: degrees clockwise from north (0=N, 90=E, 180=S, 270=W).
// elevation: degrees above horizon (negative = night).
export function sunPosition(lat, lon, dateUtc) {
  const rad = Math.PI / 180
  const start = Date.UTC(dateUtc.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((dateUtc.getTime() - start) / 86400000)
  const utcHours = dateUtc.getUTCHours() + dateUtc.getUTCMinutes() / 60
  // solar time in hours (longitude-corrected, ignoring equation-of-time ±16min)
  const solarTime = utcHours + lon / 15
  const decl = -23.45 * Math.cos(((360 / 365) * (dayOfYear + 10)) * rad) // degrees
  const hourAngle = 15 * (solarTime - 12) // degrees
  const phi = lat * rad
  const d = decl * rad
  const w = hourAngle * rad
  const sinE = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(w)
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinE))) / rad
  let azimuth = Math.atan2(Math.sin(w), Math.cos(w) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) / rad + 180
  azimuth = ((azimuth % 360) + 360) % 360
  return { azimuth, elevation }
}

// Shade fraction over sampled points: raycastFn(worldPt, sunDir) → true if blocked.
// Sun below horizon → fully shaded. Pure/injectable for TDD.
export function shadeFraction(points, sun, isBlocked) {
  if (!points?.length) return 0
  if (sun.elevation <= 0) return 1
  let shaded = 0
  for (const p of points) if (isBlocked(p)) shaded++
  return shaded / points.length
}
