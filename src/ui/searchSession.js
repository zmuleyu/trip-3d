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

  const snapshot = () => ({ state, query, results: [...results], selected, message })
  return {
    get selected() { return selected },
    snapshot,
    begin(nextQuery) {
      query = nextQuery?.trim() ?? ''
      results = []
      selected = null
      state = SEARCH_SESSION_STATES.SEARCHING
      message = '正在搜索地点…'
      return snapshot()
    },
    resolve(list) {
      results = Array.isArray(list) ? list : []
      selected = null
      state = results.length ? SEARCH_SESSION_STATES.RESULTS : SEARCH_SESSION_STATES.EMPTY
      message = results.length ? `找到 ${results.length} 个地点，请先确认城市或区县` : `未找到「${query}」`
      return snapshot()
    },
    select(place) {
      if (!place) return snapshot()
      selected = place
      state = SEARCH_SESSION_STATES.PLACE_SELECTION
      message = `${place.name} · ${place.context} · ${place.category}`
      return snapshot()
    },
    fail() {
      results = []
      selected = null
      state = SEARCH_SESSION_STATES.ERROR
      message = '暂时无法搜索地点，请稍后重试'
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
