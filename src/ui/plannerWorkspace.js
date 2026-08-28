import { iconSvg } from './icons.js'

export function createPlannerWorkspace({ onStage, onSearch, onMoreAction, onSpineExpand } = {}) {
  const el = document.createElement('div')
  el.className = 'ui-planner-workspace hidden'
  el.innerHTML = `
    <header class="ui-planner-bar">
      <div class="ui-planner-brand-island">
        <div class="ui-planner-brand"><b>TRIP <em>3D</em></b></div>
        <form class="ui-command-search" role="search">
          <input type="search" aria-label="搜索地点、线路或营地" placeholder="搜索地点、线路、营地">
          <button type="button" aria-label="搜索">${iconSvg('search')}</button>
        </form>
      </div>
      <div class="ui-planner-mode-island">
        <div class="ui-view-switch" role="tablist" aria-label="工作阶段">
          <button type="button" role="tab" data-stage="plan">规划</button>
          <button type="button" role="tab" data-stage="analyze" title="至少添加起点和终点" aria-label="分析地形（至少添加起点和终点）" disabled>分析</button>
        </div>
      </div>
    </header>
    <div class="ui-planner-more-menu hidden" role="menu" aria-label="更多操作">
      <span class="ui-planner-more-label" role="presentation">全局操作</span>
      <button type="button" role="menuitem" data-more-action="save">保存线路</button>
      <button type="button" role="menuitem" data-more-action="share">分享线路</button>
      <span class="ui-planner-more-label" role="presentation">线路传输</span>
      <button type="button" role="menuitem" data-more-action="import">导入 GPX</button>
      <button type="button" role="menuitem" data-more-action="export">导出 GPX</button>
      <span class="ui-planner-more-label" role="presentation">地图与显示</span>
      <button type="button" role="menuitem" data-more-action="admin">行政区划</button>
      <button type="button" role="menuitem" data-more-action="settings">进阶设置</button>
      <button type="button" role="menuitem" data-more-action="help">快捷键与手势</button>
      <button type="button" role="menuitem" data-more-action="reset-layout">重置面板布局</button>
    </div>
    <section class="ui-trip-spine" aria-label="路线摘要">
      <button type="button" class="ui-trip-spine-title">${iconSvg('planning')}<span>路线摘要</span></button>
      <div class="ui-trip-identity"><b>未命名线路</b><span>尚未设置日期</span></div>
      <div class="ui-trip-spine-days"></div>
      <button type="button" class="ui-trip-spine-expand">展开详情</button>
    </section>
  `
  let stage = 'plan'
  let analyzeAvailable = false
  const buttons = [...el.querySelectorAll('[data-stage]')]
  const search = el.querySelector('.ui-command-search')
  const searchInput = search.querySelector('input')
  const searchButton = search.querySelector('button')
  const spine = el.querySelector('.ui-trip-spine')
  const spineDays = spine.querySelector('.ui-trip-spine-days')
  const submitSearch = () => {
    const query = searchInput.value.trim()
    if (query) onSearch?.(query)
  }
  search.addEventListener('submit', (event) => { event.preventDefault(); submitSearch() })
  searchButton.addEventListener('click', () => {
    if (!searchInput.value.trim()) { searchInput.focus(); return }
    submitSearch()
  })
  spine.querySelector('.ui-trip-spine-title').addEventListener('click', () => onSpineExpand?.())
  spine.querySelector('.ui-trip-spine-expand').addEventListener('click', () => onSpineExpand?.())
  const moreMenu = el.querySelector('.ui-planner-more-menu')
  const setMoreOpen = (open) => {
    moreMenu.classList.toggle('hidden', !open)
  }
  moreMenu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-more-action]')?.dataset.moreAction
    if (!action) return
    setMoreOpen(false)
    onMoreAction?.(action)
  })
  const setLayersOpen = (open) => {
    document.body.classList.toggle('planner-layers-open', open)
  }
  const syncPrimary = () => {
    moreMenu.querySelector('[data-more-action="save"]').disabled = !analyzeAvailable
  }
  const applyStage = (next, notify = false) => {
    const requested = next === 'analyze' ? 'analyze' : 'plan'
    if (requested === 'analyze' && !analyzeAvailable) return false
    stage = requested
    for (const button of buttons) {
      const active = button.dataset.stage === stage
      button.classList.toggle('active', active)
      button.setAttribute('aria-selected', String(active))
      button.tabIndex = active ? 0 : -1
    }
    el.classList.toggle('stage-analyze', stage === 'analyze')
    syncPrimary()
    if (notify) onStage?.(stage)
    return true
  }
  buttons.forEach((button) => button.addEventListener('click', () => applyStage(button.dataset.stage, true)))
  el.querySelector('.ui-view-switch').addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const current = buttons.indexOf(document.activeElement)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length
    const next = buttons[nextIndex]
    if (next.disabled) return
    next.focus()
    applyStage(next.dataset.stage, true)
  })
  applyStage('plan')
  return {
    el,
    get stage() { return stage },
    get view() { return stage === 'analyze' ? '3d' : '2d' },
    setVisible(on) { el.classList.toggle('hidden', !on); if (!on) { setLayersOpen(false); setMoreOpen(false) } },
    setMoreOpen,
    toggleMore() { setMoreOpen(moreMenu.classList.contains('hidden')) },
    get moreOpen() { return !moreMenu.classList.contains('hidden') },
    setLayersOpen,
    setStage(next) { return applyStage(next) },
    setView(next) { return applyStage(next === '3d' ? 'analyze' : 'plan') },
    setAnalyzeAvailable(available, message = '至少添加起点和终点') {
      analyzeAvailable = !!available
      const analyze = el.querySelector('[data-stage="analyze"]')
      analyze.disabled = !analyzeAvailable
      analyze.title = analyzeAvailable ? '分析当前路线地形' : message
      analyze.setAttribute('aria-label', analyzeAvailable ? '分析当前路线地形' : `分析地形（${message}）`)
      syncPrimary()
    },
    setJourneySpine({ route, legs = [], weatherDays = [] } = {}) {
      spineDays.replaceChildren()
      const points = route?.waypoints ?? []
      if (points.length < 2) {
        const empty = document.createElement('span')
        empty.className = 'ui-trip-spine-empty'
        empty.textContent = '设置起点以开始规划'
        spineDays.appendChild(empty)
        return
      }
      const endIndexes = (route.dayEnds ?? [])
        .map((id) => points.findIndex((point) => point.id === id))
        .filter((index) => index > 0 && index < points.length - 1)
        .sort((a, b) => a - b)
      const boundaries = [...endIndexes, points.length - 1]
      let startIndex = 0
      boundaries.forEach((endIndex, index) => {
        const day = document.createElement('article')
        day.className = 'ui-trip-spine-day'
        const weather = weatherDays[index]
        const date = weather?.date?.slice?.(5)?.replace('-', '月')
        const dayLegs = legs.slice(startIndex, endIndex)
        const distanceM = dayLegs.reduce((sum, leg) => sum + (Number(leg.distanceM) || 0), 0)
        const weatherText = weather
          ? `${weather.isRain ? '有雨' : '天气稳定'} ${Number.isFinite(weather.tempMax) ? `${Math.round(weather.tempMax)}°` : '温度未知'}`
          : '天气未加载'
        const label = document.createElement('b')
        label.textContent = `D${index + 1}${date ? ` · ${date}日` : ''}`
        const routeText = document.createElement('span')
        routeText.textContent = `${points[startIndex].name} → ${points[endIndex].name}`
        const detail = document.createElement('small')
        detail.textContent = `${distanceM ? `${(distanceM / 1000).toFixed(1)} km · ` : ''}${weatherText}`
        day.append(label, routeText, detail)
        spineDays.appendChild(day)
        startIndex = endIndex
      })
    },
    updateTrip({ name, dateText, saved } = {}) {
      const identity = el.querySelector('.ui-trip-identity')
      identity.dataset.saved = saved == null ? '' : String(!!saved)
      identity.querySelector('b').textContent = name || '未命名线路'
      identity.querySelector('span').textContent = `${dateText || '尚未设置日期'}${saved == null ? '' : saved ? ' · 已保存' : ' · 未保存'}`
    },
    setCoverage() {},
  }
}
