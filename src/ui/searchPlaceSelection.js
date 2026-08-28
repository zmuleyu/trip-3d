export function selectSearchPlace({ session, place, publish, focus } = {}) {
  const snapshot = session?.select?.(place)
  if (!snapshot) return null
  publish?.(snapshot)
  if (Number.isFinite(place?.lon) && Number.isFinite(place?.lat)) focus?.(place.lon, place.lat)
  return snapshot
}
