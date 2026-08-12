export const ADMIN_LEVELS = Object.freeze({
  AUTO: 'auto',
  PROVINCE: 'province',
  CITY: 'city',
  DISTRICT: 'district',
})

export function filterAdminRings(rings, level = ADMIN_LEVELS.AUTO) {
  if (level === ADMIN_LEVELS.AUTO) return rings
  return rings.filter((ring) => ring.level === level)
}

export function adminNeedsReload({ enabled, loadedKey, currentKey }) {
  return !!enabled && !!currentKey && loadedKey !== currentKey
}

export function adminBreadcrumb(area = {}) {
  const values = Array.isArray(area) ? area : [area.province, area.city, area.district]
  return values.filter((value, index, list) => value && list.indexOf(value) === index)
}

export function adminEmptyMessage(area) {
  const breadcrumb = adminBreadcrumb(area)
  const deepest = breadcrumb.at(-1)
  return deepest
    ? `当前视图完全位于${deepest}内；缩小地图可查看边界。`
    : '当前视图未穿过行政边界；缩小地图可查看边界。'
}

function contains(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi) inside = !inside
  }
  return inside
}

const LEVEL_DEPTH = { province: 1, city: 2, district: 3 }
export function findDeepestAdminRegion(regions, lon, lat) {
  const matches = regions.filter((region) => region.ring?.length >= 3 && contains(lon, lat, region.ring))
  matches.sort((a, b) => (LEVEL_DEPTH[b.level] ?? 0) - (LEVEL_DEPTH[a.level] ?? 0))
  return matches[0] ?? null
}

export function createAdminInteractionState({ onChange } = {}) {
  let enabled = false
  let inspecting = false
  let selected = null
  let level = ADMIN_LEVELS.AUTO
  const notify = () => onChange?.({ enabled, inspecting, selected, level })
  return {
    get enabled() { return enabled },
    get inspecting() { return inspecting },
    get selected() { return selected },
    get level() { return level },
    setEnabled(value) {
      enabled = !!value
      if (!enabled) { inspecting = false; selected = null }
      notify()
    },
    setLevel(value) {
      if (!Object.values(ADMIN_LEVELS).includes(value)) return false
      level = value
      notify()
      return true
    },
    enterInspect() {
      if (!enabled) return false
      inspecting = true
      notify()
      return true
    },
    exitInspect() {
      if (!inspecting && !selected) return false
      inspecting = false
      selected = null
      notify()
      return true
    },
    select(feature) {
      if (!inspecting) return false
      selected = feature ?? null
      notify()
      return true
    },
    handleKey(key) {
      return key === 'Escape' ? this.exitInspect() : false
    },
  }
}
