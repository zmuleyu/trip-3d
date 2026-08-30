const segmentName = (segment) => `第 ${segment.index + 1} 段 · ${segment.from?.name || '未命名点'} → ${segment.to?.name || '未命名点'}`
const distanceText = (distanceM) => Number.isFinite(distanceM) ? `${(distanceM / 1000).toFixed(1)} km` : '暂不可用'
const elevationText = (deltaM) => Number.isFinite(deltaM)
  ? `${deltaM >= 0 ? '+' : '−'}${Math.abs(Math.round(deltaM)).toLocaleString('zh-CN')} m`
  : '暂不可用'

export function createRouteOverview({ onSelect = null } = {}) {
  const el = document.createElement('section')
  el.className = 'route-overview'
  el.setAttribute('aria-label', '路线概览')
  const selection = document.createElement('div')
  selection.className = 'route-overview-selection'
  const facts = document.createElement('div')
  facts.className = 'route-overview-facts'
  const status = document.createElement('p')
  status.className = 'route-overview-status'
  status.setAttribute('aria-live', 'polite')
  el.append(selection, facts, status)

  const factRow = (label, value, segment = null, selected = false) => {
    const row = segment ? document.createElement('button') : document.createElement('div')
    row.className = 'route-overview-row'
    if (segment) {
      row.type = 'button'
      row.disabled = !segment
      row.addEventListener('click', () => onSelect?.(segment.selection))
    }
    row.classList.toggle('is-selected', selected)
    const title = document.createElement('span')
    title.className = 'route-overview-label'
    title.textContent = label
    const detail = document.createElement('span')
    detail.className = 'route-overview-value'
    detail.textContent = value
    row.append(title, detail)
    return row
  }

  const updateSelection = (segment) => {
    selection.replaceChildren()
    if (!segment) {
      selection.classList.remove('is-selected')
      selection.textContent = '选择地图或剖面中的路段查看详情'
      return
    }
    selection.classList.add('is-selected')
    const label = document.createElement('strong')
    label.textContent = segmentName(segment)
    const distance = document.createElement('span')
    distance.textContent = distanceText(segment.distanceM)
    selection.append(label, distance)
  }

  return {
    el,
    update(overview) {
      const state = overview ?? { ready: false, status: 'incomplete', message: '至少添加起点和终点。恢复操作在高程剖面中。' }
      updateSelection(state.ready ? state.selected : null)
      facts.replaceChildren()
      status.hidden = !!state.ready
      if (!state.ready) {
        status.textContent = state.message
        return
      }
      status.textContent = ''
      const selectedIndex = state.selected?.index
      const longestText = state.longest ? `${segmentName(state.longest)} · ${distanceText(state.longest.distanceM)}` : '暂不可用'
      const elevationValue = state.elevation ? `${segmentName(state.elevation)} · ${elevationText(state.elevation.elevationDeltaM)}` : '暂不可用'
      facts.append(
        factRow('最长区间', longestText, state.longest, selectedIndex === state.longest?.index),
        factRow('最大高程变化', elevationValue, state.elevation, selectedIndex === state.elevation?.index),
        factRow('数据可用性', state.availability),
      )
    },
  }
}
