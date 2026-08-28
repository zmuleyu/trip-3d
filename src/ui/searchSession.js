export const SEARCH_SESSION_STATES = Object.freeze({
  IDLE: 'idle',
  SEARCHING: 'searching',
  RESULTS: 'results',
  PLACE_SELECTION: 'place-selection',
  EMPTY: 'empty',
  ERROR: 'error',
})

export function createSearchSession() {
  let state = SEARCH_SESSION_STATES.IDLE
  let query = ''
  let results = []
  let selected = null
  let message = '搜索地点、线路或营地'

  let source = null
  let fallbackUsed = false
  const snapshot = () => ({ state, query, results: [...results], selected, message, source, fallbackUsed })
  return {
    get selected() { return selected },
    snapshot,
    begin(nextQuery) {
      query = nextQuery?.trim() ?? ''
      results = []
      selected = null
      source = null
      fallbackUsed = false
      state = SEARCH_SESSION_STATES.SEARCHING
      message = '正在搜索地点…'
      return snapshot()
    },
    resolve(list, metadata = {}) {
      results = Array.isArray(list) ? list : []
      selected = null
      source = metadata.source ?? results[0]?.source ?? null
      fallbackUsed = !!metadata.fallbackUsed
      state = results.length ? SEARCH_SESSION_STATES.RESULTS : SEARCH_SESSION_STATES.EMPTY
      const sourceText = source?.label ? ` · 搜索来源：${source.label}` : ''
      message = results.length ? `找到 ${results.length} 个地点${sourceText}` : `未找到「${query}」${sourceText}`
      return snapshot()
    },
    select(place) {
      if (!place) return snapshot()
      selected = place
      state = SEARCH_SESSION_STATES.PLACE_SELECTION
      const sourceText = (place.source ?? source)?.label ? ` · 搜索来源：${(place.source ?? source).label}` : ''
      message = `${place.name} · ${place.context} · ${place.category}${sourceText}`
      return snapshot()
    },
    fail() {
      results = []
      selected = null
      source = null
      fallbackUsed = false
      state = SEARCH_SESSION_STATES.ERROR
      message = 'Nominatim 与 Photon 备用均暂不可用，请稍后重试'
      return snapshot()
    },
    dismissSelection() {
      selected = null
      state = results.length ? SEARCH_SESSION_STATES.RESULTS : SEARCH_SESSION_STATES.IDLE
      message = results.length ? `找到 ${results.length} 个地点，请先确认城市或区县` : '搜索地点、线路或营地'
      return snapshot()
    },
  }
}
