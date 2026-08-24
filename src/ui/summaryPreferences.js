export const SUMMARY_STORAGE_KEY = 'trip3d.summaryPreferences.v1'

export const SUMMARY_FIELDS = [
  ['days', '天数'],
  ['distance', '总距离'],
  ['duration', '预计时长'],
  ['ascent', '累计爬升'],
  ['descent', '累计下降'],
  ['maxElevation', '最高海拔'],
  ['waypoints', '途经点'],
  ['segments', '路段数'],
  ['temperature', '温度范围'],
  ['precipitation', '降水'],
  ['wind', '最大风速'],
  ['weatherRisk', '天气风险'],
  ['saveState', '保存状态'],
]

const FIELD_IDS = new Set(SUMMARY_FIELDS.map(([id]) => id))
export const DEFAULT_SUMMARY_PREFERENCES = Object.freeze({
  mode: 'auto',
  fields: ['distance', 'duration', 'ascent', 'weatherRisk'],
})

export function normalizeSummaryPreferences(value = {}) {
  const mode = value.mode === 'custom' ? 'custom' : 'auto'
  const fields = [...new Set(Array.isArray(value.fields) ? value.fields : [])]
    .filter((id) => FIELD_IDS.has(id))
    .slice(0, 4)
  return {
    mode,
    fields: fields.length ? fields : [...DEFAULT_SUMMARY_PREFERENCES.fields],
  }
}

export function loadSummaryPreferences(storage = globalThis.localStorage) {
  try {
    return normalizeSummaryPreferences(JSON.parse(storage?.getItem(SUMMARY_STORAGE_KEY) ?? '{}'))
  } catch {
    return normalizeSummaryPreferences()
  }
}

export function saveSummaryPreferences(value, storage = globalThis.localStorage) {
  const normalized = normalizeSummaryPreferences(value)
  try { storage?.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(normalized)) } catch { /* optional local preference */ }
  return normalized
}

const present = (value) => value != null && value !== '' && !(typeof value === 'number' && !Number.isFinite(value))

export function automaticSummaryFields(data = {}) {
  const available = []
  if (present(data.distanceM)) available.push('distance')
  if (present(data.durationMinutes)) available.push('duration')
  if (present(data.ascentM)) available.push('ascent')
  if (present(data.weatherRiskCount)) available.push('weatherRisk')
  if (present(data.temperatureMin) && present(data.temperatureMax)) available.push('temperature')
  if (present(data.precipitationMm)) available.push('precipitation')
  if (present(data.maxWindKmh)) available.push('wind')
  for (const fallback of ['maxElevation', 'days', 'waypoints', 'segments', 'descent', 'saveState']) {
    if (present(data[{
      maxElevation: 'maxElevationM', days: 'days', waypoints: 'waypointCount', segments: 'segmentCount',
      descent: 'descentM', saveState: 'saved',
    }[fallback]])) available.push(fallback)
  }
  return [...new Set(available)].slice(0, 4)
}

export function resolveSummaryFields(preferences, data = {}, max = 4) {
  const normalized = normalizeSummaryPreferences(preferences)
  const fields = normalized.mode === 'custom' ? normalized.fields : automaticSummaryFields(data)
  return fields.filter((id) => formatSummaryField(id, data)).slice(0, Math.max(1, max))
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return ''
  const rounded = Math.max(0, Math.round(minutes))
  if (rounded < 60) return `${rounded}分钟`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest ? `${hours}小时${rest}分` : `${hours}小时`
}

export function formatSummaryField(id, data = {}) {
  const number = (value) => Number.isFinite(value) ? Math.round(value).toLocaleString('zh-CN') : ''
  switch (id) {
    case 'days': return Number.isFinite(data.days) ? `${data.days}天` : ''
    case 'distance': return Number.isFinite(data.distanceM) ? `${(data.distanceM / 1000).toFixed(1)} km` : ''
    case 'duration': return formatDuration(data.durationMinutes)
    case 'ascent': return Number.isFinite(data.ascentM) ? `爬升 ${number(data.ascentM)} m` : ''
    case 'descent': return Number.isFinite(data.descentM) ? `下降 ${number(data.descentM)} m` : ''
    case 'maxElevation': return Number.isFinite(data.maxElevationM) ? `最高 ${number(data.maxElevationM)} m` : ''
    case 'waypoints': return Number.isFinite(data.waypointCount) ? `${data.waypointCount}个途经点` : ''
    case 'segments': return Number.isFinite(data.segmentCount) ? `${data.segmentCount}个路段` : ''
    case 'temperature': return Number.isFinite(data.temperatureMin) && Number.isFinite(data.temperatureMax)
      ? `${Math.round(data.temperatureMin)}–${Math.round(data.temperatureMax)}°C` : ''
    case 'precipitation': return Number.isFinite(data.precipitationMm) ? `降水 ${data.precipitationMm.toFixed(1)} mm` : ''
    case 'wind': return Number.isFinite(data.maxWindKmh) ? `风 ${Math.round(data.maxWindKmh)} km/h` : ''
    case 'weatherRisk': return Number.isFinite(data.weatherRiskCount) ? `${data.weatherRiskCount}处天气风险` : ''
    case 'saveState': return data.saved === true ? '已保存' : data.saved === false ? '未保存' : ''
    default: return ''
  }
}

export function formatSummary(preferences, data = {}, max = 4) {
  return resolveSummaryFields(preferences, data, max)
    .map((id) => ({ id, text: formatSummaryField(id, data) }))
    .filter((item) => item.text)
}
