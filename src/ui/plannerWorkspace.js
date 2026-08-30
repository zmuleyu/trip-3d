import { iconSvg } from './icons.js'
import { createSearchPopover } from './searchPopover.js'
import { routeSelectionIndex } from './routeSelection.js'

export function createPlannerWorkspace({
  version = '', onStage, onSearch, onSearchSelect, onSearchRole, onSearchDismiss,
  onMoreAction, onSpineExpand, onSpineDismiss, onWaypointAction, onMenuChange,
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
      <button type="button" role="menuitem" data-more-action="save"><span>保存线路</span><small data-more-save-status hidden></small></button>
      <button type="button" role="menuitem" data-more-action="share">分享线路</button>
      <span class="ui-planner-more-label" role="presentation">编辑历史</span>
      <button type="button" role="menuitem" data-more-action="undo"><span>撤销</span><kbd>Ctrl/⌘ Z</kbd></button>
      <button type="button" role="menuitem" data-more-action="redo"><span>重做</span><kbd>Ctrl/⌘ ⇧ Z</kbd></button>
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
  let analysisStale = false
  let analyzeUnavailableMessage = '至少添加起点和终点'
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
  let layersSurface = null
  let layersTrigger = null
  let layerReturnFocus = null
  let moreReturnFocus = null
  const setMoreOpen = (open, { restoreFocus = true } = {}) => {
    const next = !!open
    if (next) {
      setLayersOpen(false, { restoreFocus: false })
      moreReturnFocus = document.activeElement
    }
    moreMenu.classList.toggle('hidden', !next)
    if (!next && restoreFocus) moreReturnFocus?.focus?.()
    onMenuChange?.('more', next)
  }
  moreMenu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-more-action]')?.dataset.moreAction
    if (!action) return
    setMoreOpen(false)
    onMoreAction?.(action)
  })
  const syncLayersTrigger = (open) => {
    layersTrigger?.setAttribute('aria-expanded', String(open))
    layersTrigger?.setAttribute('aria-label', open ? '关闭图层工具' : '打开图层工具')
  }
  const setLayersOpen = (open, { restoreFocus = false } = {}) => {
    if (open) setMoreOpen(false, { restoreFocus: false })
    const next = !!open
    if (next) layerReturnFocus = document.activeElement
    document.body.classList.toggle('planner-layers-open', next)
    syncLayersTrigger(next)
    if (!next && restoreFocus) (layersTrigger ?? layerReturnFocus)?.focus?.()
    onMenuChange?.('layers', next)
  }
  const isLayersOpen = () => document.body.classList.contains('planner-layers-open')
  let outsideLayerPointer = null
  const isOutsideLayerPointer = (event) => {
    const path = event.composedPath?.() ?? []
    return !!outsideLayerPointer && (path.includes(outsideLayerPointer.target) || event.target === outsideLayerPointer.target)
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !moreMenu.classList.contains('hidden')) {
      event.preventDefault()
      setMoreOpen(false)
      return
    }
    if (event.key !== 'Escape' || !layersSurface || !isLayersOpen()) return
    event.preventDefault()
    setLayersOpen(false, { restoreFocus: true })
  })
  document.addEventListener('pointerdown', (event) => {
    if (!layersSurface || !isLayersOpen()) return
    if (layersSurface?.contains(event.target) || layersTrigger?.contains(event.target)) return
    outsideLayerPointer = { target: event.target, pointerId: event.pointerId }
    setLayersOpen(false)
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
  document.addEventListener('pointerup', (event) => {
    if (!isOutsideLayerPointer(event) || event.pointerId !== outsideLayerPointer.pointerId) return
    event.preventDefault()
    event.stopImmediatePropagation()
    requestAnimationFrame(() => { outsideLayerPointer = null })
  }, true)
  document.addEventListener('click', (event) => {
    if (!isOutsideLayerPointer(event)) return
    outsideLayerPointer = null
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
  const syncPrimary = () => {
    moreMenu.querySelector('[data-more-action="save"]').disabled = !analyzeAvailable
  }
  const syncHistory = ({ canUndo = false, canRedo = false } = {}) => {
    moreMenu.querySelector('[data-more-action="undo"]').disabled = !canUndo
    moreMenu.querySelector('[data-more-action="redo"]').disabled = !canRedo
  }
  const syncSaveStatus = (status) => {
    const saveStatus = moreMenu.querySelector('[data-more-save-status]')
    const copy = { saved: '已保存到本机', dirty: '未保存更改', failed: '保存失败', unavailable: '本机存储不可用' }[status] ?? ''
    saveStatus.hidden = !copy
    saveStatus.textContent = copy
  }
  const syncAnalyzeCopy = () => {
    const analyze = el.querySelector('[data-stage="analyze"]')
    const stale = analysisStale
    const copy = stale
      ? { label: '重新分析', title: '路线已变更，重新分析地形', aria: '重新分析地形（路线已变更）' }
      : analyzeAvailable
        ? { label: '分析', title: '分析当前路线地形', aria: '分析当前路线地形' }
        : { label: '分析', title: analyzeUnavailableMessage, aria: `分析地形（${analyzeUnavailableMessage}）` }
    analyze.textContent = copy.label
    analyze.title = copy.title
    analyze.setAttribute('aria-label', copy.aria)
  }
  const applyStage = (next, notify = false) => {
    const requested = next === 'analyze' ? 'analyze' : 'plan'
    if (requested === 'analyze' && !analyzeAvailable) return false
    stage = requested
    setLayersOpen(false, { restoreFocus: false })
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
    setVisible(on) { el.classList.toggle('hidden', !on); if (!on) { setLayersOpen(false); setMoreOpen(false, { restoreFocus: false }) } },
    setMoreOpen,
    toggleMore() { setMoreOpen(moreMenu.classList.contains('hidden')) },
    get moreOpen() { return !moreMenu.classList.contains('hidden') },
    setLayersOpen,
    attachLayers({ trigger, surface } = {}) {
      layersTrigger = trigger ?? layersTrigger
      layersSurface = surface ?? layersSurface
      if (layersSurface?.id) layersTrigger?.setAttribute('aria-controls', layersSurface.id)
      syncLayersTrigger(isLayersOpen())
    },
    setStage(next) { return applyStage(next) },
    setView(next) { return applyStage(next === '3d' ? 'analyze' : 'plan') },
    setAnalyzeAvailable(available, message = '至少添加起点和终点') {
      analyzeAvailable = !!available
      analyzeUnavailableMessage = message
      const analyze = el.querySelector('[data-stage="analyze"]')
      analyze.disabled = !analyzeAvailable
      syncAnalyzeCopy()
      syncPrimary()
    },
    setAnalysisFreshness({ stale = false } = {}) {
      analysisStale = !!stale
      syncAnalyzeCopy()
      el.classList.toggle('analysis-stale', analysisStale)
    },
    setHistoryState(state) { syncHistory(state) },
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
      spine.classList.toggle('waypoint-selected', visible && selection?.kind === 'waypoint')
      if (!visible) return
      const spineTitle = spine.querySelector('.ui-trip-spine-title')
      const selectionTitle = spineTitle.querySelector('span')
      const identity = spine.querySelector('.ui-trip-identity')
      const identityName = identity.querySelector('b')
      const identityMeta = identity.querySelector('span')
      const detail = document.createElement('article')
      detail.className = 'ui-trip-spine-day'
      if (selection.kind === 'waypoint') {
        const waypoint = points[selectionIndex]
        const role = selectionIndex === 0 ? '起点' : selectionIndex === points.length - 1 ? '终点' : '途经点'
        selectionTitle.textContent = '地点摘要'
        spineTitle.setAttribute('aria-label', '查看地点详情')
        identityName.textContent = waypoint.name
        identityMeta.textContent = role
        const actionRegion = document.createElement('section')
        actionRegion.className = 'ui-waypoint-actions'
        actionRegion.setAttribute('aria-label', '途经点操作')
        const actionTitle = document.createElement('span')
        actionTitle.textContent = '途经点操作'
        const actionList = document.createElement('div')
        actionList.className = 'ui-waypoint-action-list'
        const rename = document.createElement('button')
        rename.type = 'button'
        rename.dataset.waypointAction = 'rename'
        rename.textContent = '重命名'
        rename.setAttribute('aria-expanded', 'false')
        const renameForm = document.createElement('form')
        renameForm.className = 'ui-waypoint-rename hidden'
        const renameInput = document.createElement('input')
        renameInput.type = 'text'
        renameInput.value = waypoint.name
        renameInput.setAttribute('aria-label', '途经点名称')
        const confirmRename = document.createElement('button')
        confirmRename.type = 'submit'
        confirmRename.textContent = '确认'
        renameForm.append(renameInput, confirmRename)
        const setRenameOpen = (open, { restoreFocus = true } = {}) => {
          renameForm.classList.toggle('hidden', !open)
          rename.setAttribute('aria-expanded', String(open))
          if (open) {
            renameInput.focus()
            renameInput.select()
          } else if (restoreFocus) rename.focus()
        }
        rename.addEventListener('click', () => setRenameOpen(renameForm.classList.contains('hidden')))
        renameForm.addEventListener('submit', (event) => {
          event.preventDefault()
          const name = renameInput.value.trim()
          if (!name || name === waypoint.name) return setRenameOpen(false)
          onWaypointAction?.({ action: 'rename', waypointId: waypoint.id, name })
        })
        renameInput.addEventListener('keydown', (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          setRenameOpen(false)
        })
        const insert = document.createElement('button')
        insert.type = 'button'
        insert.dataset.waypointAction = 'insert-after'
        insert.textContent = '在后方插入'
        insert.addEventListener('click', () => onWaypointAction?.({ action: 'insert-after', waypointId: waypoint.id }))
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.dataset.waypointAction = 'remove'
        remove.className = 'danger'
        remove.textContent = '删除'
        remove.addEventListener('click', () => onWaypointAction?.({ action: 'remove', waypointId: waypoint.id }))
        const recovery = document.createElement('small')
        recovery.textContent = '删除后可通过撤销恢复'
        actionList.append(rename, insert, remove)
        actionRegion.append(actionTitle, actionList, renameForm, recovery)
        detail.appendChild(actionRegion)
      } else {
        const label = document.createElement('b')
        const routeText = document.createElement('span')
        const meta = document.createElement('small')
        const from = points[selectionIndex]
        const to = points[selectionIndex + 1]
        const leg = legs[selectionIndex]
        selectionTitle.textContent = '路线摘要'
        spineTitle.removeAttribute('aria-label')
        identityName.textContent = `${from.name} → ${to.name}`
        identityMeta.textContent = `第 ${selectionIndex + 1} 段`
        label.textContent = `路线段 ${selectionIndex + 1}`
        routeText.textContent = `${from.name} → ${to.name}`
        const distance = Number.isFinite(leg?.distanceM) ? `${(leg.distanceM / 1000).toFixed(1)} km` : '距离未知'
        const duration = Number.isFinite(leg?.durationS) ? ` · ${Math.round(leg.durationS / 60)} 分钟` : ''
        const weather = weatherDays[Math.min(weatherDays.length - 1, Math.max(0, route?.dayNumberAt?.(selectionIndex) - 1))]
        const weatherText = weather ? ` · ${weather.isRain ? '有雨' : '天气稳定'}${Number.isFinite(weather.tempMax) ? ` ${Math.round(weather.tempMax)}°` : ''}` : ''
        meta.textContent = `${distance}${duration}${weatherText}`
        detail.append(label, routeText, meta)
      }
      spineDays.appendChild(detail)
    },
    focusWaypointAction(action) {
      const control = spine.querySelector(`[data-waypoint-action="${action}"]`)
      control?.focus()
      return !!control
    },
    updateTrip({ name, dateText, saved, saveStatus } = {}) {
      const identity = el.querySelector('.ui-trip-identity')
      const status = saveStatus ?? (saved == null ? 'idle' : saved ? 'saved' : 'dirty')
      identity.dataset.saved = status === 'saved' ? 'true' : status === 'idle' ? '' : 'false'
      identity.querySelector('b').textContent = name || '未命名线路'
      const saveCopy = { saved: '已保存到本机', dirty: '未保存更改', failed: '保存失败', unavailable: '本机存储不可用', idle: '' }[status] ?? ''
      identity.querySelector('span').textContent = `${dateText || '尚未设置日期'}${saveCopy ? ` · ${saveCopy}` : ''}`
      syncSaveStatus(status)
    },
    setCoverage() {},
  }
}
