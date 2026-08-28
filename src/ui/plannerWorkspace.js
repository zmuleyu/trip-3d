import { iconSvg } from './icons.js'
import { createSearchPopover } from './searchPopover.js'
import { routeSelectionIndex } from './routeSelection.js'

export function createPlannerWorkspace({
  version = '', onStage, onSearch, onSearchSelect, onSearchRole, onSearchDismiss,
  onMoreAction, onSpineExpand, onSpineDismiss, onMenuChange,
} = {}) {
  const el = document.createElement('div')
  el.className = 'ui-planner-workspace hidden'
  el.innerHTML = `
    <header class="ui-planner-bar">
      <div class="ui-planner-brand-island">
        <div class="ui-planner-brand"><b>TRIP <em>3D</em></b><small class="ui-planner-version" hidden></small></div>
        <form class="ui-command-search" role="search">
          <input type="search" aria-label="搜索地点、线路或营地" placeholder="搜索地点、线路、营地" autocomplete="off" spellcheck="false">
          <button type="submit" aria-label="搜索">${iconSvg('search')}</button>
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
    <section class="ui-trip-spine hidden" aria-label="路线摘要">
      <button type="button" class="ui-trip-spine-title">${iconSvg('planning')}<span>路线摘要</span></button>
      <div class="ui-trip-identity"><b>未命名线路</b><span>尚未设置日期</span></div>
      <div class="ui-trip-spine-days"></div>
      <button type="button" class="ui-trip-spine-expand">展开详情</button>
      <button type="button" class="ui-trip-spine-close" aria-label="关闭路线摘要">${iconSvg('close')}</button>
    </section>
  `
  const versionLabel = el.querySelector('.ui-planner-version')
  versionLabel.textContent = version ? `v${version}` : ''
  versionLabel.hidden = !version
  let stage = 'plan'
  let analyzeAvailable = false
  const buttons = [...el.querySelectorAll('[data-stage]')]
  const search = el.querySelector('.ui-command-search')
  const searchInput = search.querySelector('input')
  const searchButton = search.querySelector('button')
  const searchPopover = createSearchPopover({ onSelect: onSearchSelect, onRole: onSearchRole, onDismiss: onSearchDismiss })
  el.querySelector('.ui-planner-brand-island').appendChild(searchPopover.el)
  searchInput.setAttribute('aria-controls', searchPopover.el.id)
  searchInput.setAttribute('aria-expanded', 'false')
  const spine = el.querySelector('.ui-trip-spine')
  const spineDays = spine.querySelector('.ui-trip-spine-days')
  const submitSearch = () => {
    const query = searchInput.value.trim()
    if (query) onSearch?.(query)
  }
  search.addEventListener('submit', (event) => { event.preventDefault(); submitSearch() })
  searchButton.addEventListener('click', (event) => {
    if (searchInput.value.trim()) return
    event.preventDefault()
    searchInput.focus()
  })
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && searchInput.getAttribute('aria-expanded') === 'true') {
      event.preventDefault()
      searchPopover.focusFirstResult()
    }
    if (event.key === 'Escape' && searchInput.getAttribute('aria-expanded') === 'true') {
      event.preventDefault()
      onSearchDismiss?.({ restoreFocus: true })
    }
  })
  spine.querySelector('.ui-trip-spine-title').addEventListener('click', () => onSpineExpand?.())
  spine.querySelector('.ui-trip-spine-expand').addEventListener('click', () => onSpineExpand?.())
  spine.querySelector('.ui-trip-spine-close').addEventListener('click', () => onSpineDismiss?.())
  const moreMenu = el.querySelector('.ui-planner-more-menu')
  const setMoreOpen = (open) => {
    if (open) setLayersOpen(false)
    moreMenu.classList.toggle('hidden', !open)
    onMenuChange?.('more', !!open)
  }
  moreMenu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-more-action]')?.dataset.moreAction
    if (!action) return
    setMoreOpen(false)
    onMoreAction?.(action)
  })
  const setLayersOpen = (open) => {
    if (open) setMoreOpen(false)
    document.body.classList.toggle('planner-layers-open', open)
    onMenuChange?.('layers', !!open)
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
    setSearchSession(session) {
      searchPopover.update(session)
      searchInput.setAttribute('aria-expanded', String(session?.state && session.state !== 'idle'))
      if (session?.state === 'idle') searchInput.removeAttribute('aria-activedescendant')
    },
    focusSearch() { searchInput.focus() },
    setJourneySpine({ route, legs = [], weatherDays = [], selection = null } = {}) {
      spineDays.replaceChildren()
      const points = route?.waypoints ?? []
      const selectionIndex = routeSelectionIndex(selection, route)
      const visible = points.length >= 2 && selectionIndex >= 0
      spine.classList.toggle('hidden', !visible)
      if (!visible) return
      const selectionTitle = spine.querySelector('.ui-trip-spine-title span')
      const identity = spine.querySelector('.ui-trip-identity')
      const identityName = identity.querySelector('b')
      const identityMeta = identity.querySelector('span')
      const detail = document.createElement('article')
      detail.className = 'ui-trip-spine-day'
      const label = document.createElement('b')
      const routeText = document.createElement('span')
      const meta = document.createElement('small')
      if (selection.kind === 'waypoint') {
        const waypoint = points[selectionIndex]
        const role = selectionIndex === 0 ? '起点' : selectionIndex === points.length - 1 ? '终点' : '途经点'
        selectionTitle.textContent = '地点摘要'
        identityName.textContent = waypoint.name
        identityMeta.textContent = role
        label.textContent = `${role} · ${selectionIndex + 1}/${points.length}`
        routeText.textContent = `${Number(waypoint.lon).toFixed(4)}, ${Number(waypoint.lat).toFixed(4)}`
        const weather = weatherDays[Math.min(weatherDays.length - 1, Math.max(0, route?.dayNumberAt?.(selectionIndex) - 1))]
        meta.textContent = weather ? `${weather.isRain ? '有雨' : '天气稳定'}${Number.isFinite(weather.tempMax) ? ` · ${Math.round(weather.tempMax)}°` : ''}` : '天气未加载'
      } else {
        const from = points[selectionIndex]
        const to = points[selectionIndex + 1]
        const leg = legs[selectionIndex]
        selectionTitle.textContent = '路线摘要'
        identityName.textContent = `${from.name} → ${to.name}`
        identityMeta.textContent = `第 ${selectionIndex + 1} 段`
        label.textContent = `路线段 ${selectionIndex + 1}`
        routeText.textContent = `${from.name} → ${to.name}`
        const distance = Number.isFinite(leg?.distanceM) ? `${(leg.distanceM / 1000).toFixed(1)} km` : '距离未知'
        const duration = Number.isFinite(leg?.durationS) ? ` · ${Math.round(leg.durationS / 60)} 分钟` : ''
        const weather = weatherDays[Math.min(weatherDays.length - 1, Math.max(0, route?.dayNumberAt?.(selectionIndex) - 1))]
        const weatherText = weather ? ` · ${weather.isRain ? '有雨' : '天气稳定'}${Number.isFinite(weather.tempMax) ? ` ${Math.round(weather.tempMax)}°` : ''}` : ''
        meta.textContent = `${distance}${duration}${weatherText}`
      }
      detail.append(label, routeText, meta)
      spineDays.appendChild(detail)
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
