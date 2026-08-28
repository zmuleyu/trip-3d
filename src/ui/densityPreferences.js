export const DENSITY_MODES = Object.freeze(['compact', 'standard', 'large'])
export const DEFAULT_DENSITY = 'standard'
export const DENSITY_STORAGE_KEY = 'trip3d.uiDensity.v1'

export function normalizeDensity(value) {
  return DENSITY_MODES.includes(value) ? value : DEFAULT_DENSITY
}

export function loadDensity(storage = globalThis.localStorage) {
  try { return normalizeDensity(storage?.getItem?.(DENSITY_STORAGE_KEY)) } catch { return DEFAULT_DENSITY }
}

export function saveDensity(value, storage = globalThis.localStorage) {
  const density = normalizeDensity(value)
  try { storage?.setItem?.(DENSITY_STORAGE_KEY, density) } catch { /* optional local preference */ }
  return density
}

export function applyDensity(value, root = globalThis.document?.documentElement) {
  const density = normalizeDensity(value)
  if (root) root.dataset.uiDensity = density
  return density
}
