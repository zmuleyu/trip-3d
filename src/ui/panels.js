// Context panel contents + profile floating card. DOM only; fed by main.js.
import { normalizeRouteMode } from '../lib/routePlanning.js'
import { analysisPointsReady, nearestAnalysisIndex, sampleAnalysisAtDistance } from '../lib/analysisCursor.js'
import { sampleRouteGradeAtDistance } from '../lib/routeAnalysis.js'

// ---------------------------------------------------------------- planning panel
// duration formatting: ≥24h shows days (long road trips)
const fmtDur = (minutes) => {
  const m = Math.round(minutes)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}天${h % 24}h${m % 60 ? `${m % 60}m` : ''}`
}

export function createPlanningPanel(actions) {
  const el = document.createElement('div')
  el.className = 'pp-root'

  // ---- route mode: first-class straight / foot / car contract
  const snapRow = document.createElement('div')
  snapRow.className = 'pp-snap-row'
  const modeGroup = document.createElement('div')
  modeGroup.className = 'pp-route-mode'
  modeGroup.setAttribute('role', 'group')
  modeGroup.setAttribute('aria-label', '路线模式')
  const modeButtons = new Map()
  for (const [mode, label] of [['straight', '直线'], ['foot', '步行'], ['car', '驾车']]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.mode = mode
    button.textContent = label
    button.onclick = () => actions.onRouteMode?.(mode)
    modeButtons.set(mode, button)
    modeGroup.appendChild(button)
  }
  const snapStatus = document.createElement('span')
  snapStatus.className = 'pp-snap-status'
  snapRow.append(modeGroup, snapStatus)
  el.appendChild(snapRow)

  // Candidates are derived from one provider result only. Their controls are
  // native buttons, so a route choice remains discoverable and keyboard usable.
  const alternatives = document.createElement('div')
  alternatives.className = 'pp-route-alternatives hidden'
  alternatives.setAttribute('role', 'group')
  alternatives.setAttribute('aria-label', '路线方案')

  const mobilePrimary = document.createElement('div')
  mobilePrimary.className = 'pp-mobile-primary'
  const mapFocus = document.createElement('button')
  mapFocus.type = 'button'
  mapFocus.className = 'primary'
  mapFocus.textContent = '回到地图继续加点'
  mapFocus.onclick = () => actions.onMapFocus?.()
  const mobileSave = document.createElement('button')
  mobileSave.type = 'button'
  mobileSave.textContent = '保存路线'
  mobileSave.onclick = () => actions.onSave?.()
  mobilePrimary.append(mapFocus, mobileSave)
  el.appendChild(mobilePrimary)

  // ---- amap link import (below snap row)
  const amapRow = document.createElement('div')
  amapRow.className = 'pp-amap-row'
  const amapToggle = document.createElement('button')
  amapToggle.textContent = '导入高德链接'
  amapToggle.className = 'pp-amap-toggle'
  amapRow.appendChild(amapToggle)
  const amapBox = document.createElement('div')
  amapBox.className = 'pp-amap-box hidden'
  const amapInput = document.createElement('input')
  amapInput.placeholder = '粘贴 amap.com 行程分享链接…'
  amapInput.setAttribute('aria-label', '高德分享链接')
  const amapGo = document.createElement('button')
  amapGo.textContent = '导入'
  amapGo.className = 'primary'
  amapBox.append(amapInput, amapGo)
  amapRow.appendChild(amapBox)
  amapToggle.onclick = () => amapBox.classList.toggle('hidden')
  amapGo.onclick = () => actions.onImportAmap?.(amapInput.value)

  const secOf = (label) => {
    const d = document.createElement('div')
    d.className = 'pp-section'
    d.textContent = label
    return d
  }

  const nameSection = secOf('命名')
  const name = document.createElement('input')
  name.className = 'name-input'
  name.setAttribute('aria-label', '线路名称')
  name.value = '未命名线路'
  name.onchange = () => actions.onNameChange(name.value)
  const routeSection = secOf('加点')

  const wpList = document.createElement('div')
  wpList.className = 'ui-wp-list pp-tl'
  el.appendChild(wpList)

  // Keep one persistent save action. Editing and import tools stay available in
  // one disclosed group instead of competing with the route itself.
  const opsMain = document.createElement('div')
  opsMain.className = 'pp-ops-main'
  const save = document.createElement('button')
  save.className = 'primary'
  save.textContent = '保存线路'
  save.onclick = actions.onSave
  opsMain.appendChild(save)

  const secondary = document.createElement('details')
  secondary.className = 'pp-secondary-tools'
  const secondarySummary = document.createElement('summary')
  secondarySummary.textContent = '编辑与导入'
  secondary.appendChild(secondarySummary)
  secondary.appendChild(amapRow)
  const opsEdit = document.createElement('div')
  opsEdit.className = 'pp-ops-edit'
  const mkE = (label, fn, danger = false) => {
    const b = document.createElement('button')
    b.textContent = label
    if (danger) b.classList.add('danger')
    b.onclick = fn
    opsEdit.appendChild(b)
  }
  mkE('撤销', actions.onUndo)
  mkE('重做', actions.onRedo)
  mkE('清空', actions.onClear, true)
  mkE('反向', actions.onReverse)
  mkE('闭环', actions.onCloseLoop)
  secondary.appendChild(opsEdit)
  const importGpx = document.createElement('button')
  importGpx.type = 'button'
  importGpx.className = 'pp-import-gpx'
  importGpx.textContent = '导入 GPX'
  importGpx.onclick = actions.onImportGpx
  secondary.appendChild(importGpx)
  // The inspector has one task: name the route, add/reorder points, then save.
  // Route summaries, day cards, and elevation details stay on the map surface.
  el.replaceChildren(nameSection, name, routeSection, snapRow, alternatives, wpList, secondary, opsMain, mobilePrimary)

  return {
    el,
    get nameEl() { return name },
    setRouteAlternatives(candidates = [], selectedIndex = 0) {
      alternatives.replaceChildren()
      const valid = candidates.length > 1 ? candidates.slice(0, 2) : []
      alternatives.classList.toggle('hidden', valid.length < 2)
      valid.forEach((candidate, index) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'pp-route-alternative'
        const selected = index === selectedIndex
        button.classList.toggle('selected', selected)
        button.setAttribute('aria-pressed', String(selected))
        const distance = Number.isFinite(candidate.distanceM) ? `${(candidate.distanceM / 1000).toFixed(1)} km` : '距离未知'
        const duration = Number.isFinite(candidate.durationS) ? fmtDur(candidate.durationS / 60) : '时长未知'
        button.textContent = `方案 ${index + 1}${selected ? '（当前）' : ''} · ${distance} · ${duration}`
        button.onclick = () => actions.onRouteAlternative?.(index)
        alternatives.appendChild(button)
      })
    },
    // Keep the established positional update contract; the inspector only renders
    // editable route controls while summaries remain on the map surface.
    update(route, stats, legs = null, weatherIndex = null, profile = 'foot', weatherDays = null, waypointElevation = {}, selectedWaypointId = null) {
      if (document.activeElement !== name) name.value = route.name
      wpList.replaceChildren()
      const n = route.waypoints.length
      mobileSave.disabled = n < 2
      save.disabled = n < 2
      // loop route: last point within ~25m of the first → merged start/end marker
      const wpsArr = route.waypoints
      const isLoop = n > 1 && Math.hypot(wpsArr[0].lon - wpsArr[n - 1].lon, wpsArr[0].lat - wpsArr[n - 1].lat) < 0.0003
      route.waypoints.forEach((w, i) => {
        const item = document.createElement('div')
        const selected = w.id === selectedWaypointId
        item.className = 'pp-tl-item pp-ledger-item'
        item.classList.toggle('selected', selected)
        item.dataset.waypointId = w.id
        const role = i === 0 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'via'
        const row = document.createElement('button')
        row.type = 'button'
        row.className = 'pp-ledger-row'
        row.setAttribute('aria-expanded', String(selected))
        row.setAttribute('aria-controls', `waypoint-actions-${w.id}`)
        row.onclick = () => actions.onWaypointSelect?.(w.id)
        const sequence = document.createElement('span')
        sequence.className = 'pp-ledger-sequence'
        sequence.textContent = `P${i + 1}`
        const dot = document.createElement('span')
        dot.className = `pp-tl-dot ${role}`
        const roleLabel = document.createElement('b')
        roleLabel.className = 'pp-tl-role'
        roleLabel.textContent = role === 'start' ? '起点' : role === 'end' ? '终点' : '途经点'
        const nm = document.createElement('span')
        nm.className = 'pp-tl-name'
        nm.textContent = isLoop && i === n - 1 ? `${w.name}(环线终点)` : w.name
        // Keep enrichment truthful to assistive technology without adding a second
        // visual metrics row to the compact route ledger.
        const elevation = document.createElement('span')
        elevation.className = 'visually-hidden'
        const measuredElevation = waypointElevation.values?.[w.id]
        elevation.textContent = waypointElevation.status === 'loading'
          ? '高程待补齐'
          : waypointElevation.status === 'ready' && Number.isFinite(measuredElevation)
            ? `${Math.round(measuredElevation)}m`
            : '高程暂不可用'
        const chevron = document.createElement('span')
        chevron.className = 'pp-ledger-chevron'
        chevron.setAttribute('aria-hidden', 'true')
        chevron.textContent = selected ? '⌃' : '⌄'
        row.append(sequence, dot, roleLabel, nm, elevation, chevron)
        item.appendChild(row)
        if (selected) {
          const actionsEl = document.createElement('div')
          actionsEl.className = 'pp-ledger-actions'
          actionsEl.id = `waypoint-actions-${w.id}`
          actionsEl.setAttribute('aria-label', `${w.name} 操作`)
          const rename = document.createElement('button')
          rename.type = 'button'
          rename.textContent = '重命名'
          const renameForm = document.createElement('form')
          renameForm.className = 'pp-ledger-rename hidden'
          const renameInput = document.createElement('input')
          renameInput.value = w.name
          renameInput.setAttribute('aria-label', '途经点名称')
          const confirm = document.createElement('button')
          confirm.type = 'submit'
          confirm.textContent = '确认'
          renameForm.append(renameInput, confirm)
          rename.onclick = () => {
            renameForm.classList.remove('hidden')
            renameInput.focus()
            renameInput.select()
          }
          renameForm.onsubmit = (event) => {
            event.preventDefault()
            actions.onWpRenameById?.(w.id, renameInput.value.trim() || w.name)
          }
          const insert = document.createElement('button')
          insert.type = 'button'
          insert.textContent = '在后方插入'
          insert.onclick = () => actions.onWpInsertAfter?.(w.id)
          const remove = document.createElement('button')
          remove.type = 'button'
          remove.className = 'danger'
          remove.textContent = '删除'
          remove.disabled = n <= 2
          remove.title = n <= 2 ? '至少保留起点和终点' : ''
          remove.onclick = () => actions.onWpRemoveById?.(w.id)
          actionsEl.append(rename, renameForm, insert, remove)
          item.appendChild(actionsEl)
        }
        wpList.appendChild(item)
      })

      const addPoint = document.createElement('button')
      addPoint.type = 'button'
      addPoint.className = 'pp-add-waypoint'
      addPoint.textContent = '＋ 增加途经点'
      addPoint.onclick = () => actions.onInsertAt?.(n)
      wpList.appendChild(addPoint)

    },

    search(query) {
      actions.onSearch?.(query ?? '')
    },

    // ---- route-mode API
    setRouteMode(mode, statusText) {
      const normalized = normalizeRouteMode(mode)
      for (const [value, button] of modeButtons) {
        const active = value === normalized
        button.classList.toggle('active', active)
        button.setAttribute('aria-pressed', String(active))
      }
      snapStatus.textContent = statusText ?? ''
    },
  }
}

// ---------------------------------------------------------------- library panel
export function createLibraryPanel(actions) {
  const el = document.createElement('div')
  el.className = 'route-library-panel'
  const list = document.createElement('div')
  el.appendChild(list)
  return {
    el,
    setItems(items) {
      list.replaceChildren()
      if (!items.length) {
        const e = document.createElement('div')
        e.className = 'ui-empty'
        const copy = document.createElement('p')
        const draft = actions.getCurrent?.()
        const hasDraft = (draft?.waypoints?.length ?? 0) >= 2
        copy.textContent = hasDraft
          ? `当前正在编辑「${draft.name || '未命名线路'}」，尚未保存到本机路线库。`
          : '线路库为空。开始规划并保存第一条线路后，它会出现在这里。'
        const plan = document.createElement('button')
        plan.type = 'button'
        plan.textContent = hasDraft ? '保存当前路线' : '开始规划'
        plan.onclick = () => hasDraft ? actions.onSaveCurrent?.() : actions.onPlan?.()
        e.append(copy, plan)
        if (hasDraft) {
          const keepEditing = document.createElement('button')
          keepEditing.type = 'button'
          keepEditing.className = 'secondary'
          keepEditing.textContent = '继续编辑'
          keepEditing.onclick = () => actions.onPlan?.()
          e.appendChild(keepEditing)
        }
        list.appendChild(e)
        return
      }
      for (const it of items) {
        const row = document.createElement('div')
        row.className = 'ui-lib-item'
        const nm = document.createElement('span')
        nm.className = 'nm'
        nm.textContent = `${it.name} (${it.waypointCount}点)`
        const load = document.createElement('button')
        load.textContent = '加载'
        load.onclick = () => actions.onLoad(it.id)
        const del = document.createElement('button')
        del.textContent = '删除'
        del.onclick = () => actions.onDelete(it.id)
        row.append(nm, load, del)
        list.appendChild(row)
      }
    },
  }
}

// ---------------------------------------------------------------- profile card
export function createProfileCard(accent = '#ff4d00') {
  const el = document.createElement('section')
  el.className = 'ui-profile hidden'
  el.dataset.status = 'incomplete'
  el.setAttribute('aria-label', '路线高程剖面')
  const head = document.createElement('button')
  head.type = 'button'
  head.className = 'head'
  const title = document.createElement('span')
  title.textContent = '路线高程'
  const fold = document.createElement('span')
  fold.className = 'fold'
  fold.textContent = '收起'
  head.append(title, fold)
  head.setAttribute('aria-expanded', 'true')
  const body = document.createElement('div')
  body.className = 'profile-body'
  const metrics = document.createElement('div')
  metrics.className = 'profile-metrics'
  const status = document.createElement('p')
  status.className = 'profile-status profile-status-pill'
  status.setAttribute('aria-live', 'polite')
  const statusMessage = document.createElement('span')
  const cursorReadout = document.createElement('span')
  const comparisonLive = document.createElement('p')
  comparisonLive.className = 'profile-comparison-live'
  comparisonLive.setAttribute('aria-live', 'polite')
  const terrainNotice = document.createElement('p')
  terrainNotice.className = 'profile-terrain-notice'
  terrainNotice.setAttribute('aria-live', 'polite')
  terrainNotice.hidden = true
  const retryTerrain = document.createElement('button')
  retryTerrain.type = 'button'
  retryTerrain.className = 'profile-recovery'
  retryTerrain.textContent = '重试 3D'
  const terrainReturnPlan = document.createElement('button')
  terrainReturnPlan.type = 'button'
  terrainReturnPlan.className = 'profile-recovery profile-return-plan'
  terrainReturnPlan.textContent = '返回规划'
  const terrainActions = document.createElement('div')
  terrainActions.className = 'profile-recovery-actions profile-terrain-actions'
  terrainActions.hidden = true
  terrainActions.append(retryTerrain, terrainReturnPlan)
  cursorReadout.className = 'profile-cursor-readout'
  const recovery = document.createElement('button')
  recovery.type = 'button'
  recovery.className = 'profile-recovery'
  recovery.hidden = true
  recovery.textContent = '重试'
  const returnPlan = document.createElement('button')
  returnPlan.type = 'button'
  returnPlan.className = 'profile-recovery profile-return-plan'
  returnPlan.hidden = true
  returnPlan.textContent = '返回规划'
  const recoveryActions = document.createElement('div')
  recoveryActions.className = 'profile-recovery-actions'
  recoveryActions.hidden = true
  recoveryActions.append(recovery, returnPlan)
  const canvas = document.createElement('canvas')
  canvas.width = 596
  canvas.height = 110
  const source = document.createElement('small')
  source.className = 'profile-source'
  const detailsToggle = document.createElement('button')
  detailsToggle.type = 'button'
  detailsToggle.className = 'profile-details-toggle'
  detailsToggle.textContent = '路线详情'
  detailsToggle.setAttribute('aria-expanded', 'false')
  const details = document.createElement('div')
  details.className = 'profile-details'
  details.hidden = true
  const segmentDetails = document.createElement('div')
  segmentDetails.className = 'profile-segment-details'
  segmentDetails.hidden = true
  details.append(segmentDetails, metrics, source)
  status.append(statusMessage, cursorReadout)
  body.append(terrainNotice, status, comparisonLive, recoveryActions, terrainActions, canvas, detailsToggle, details)
  el.append(head, body)
  document.body.appendChild(el)
  let stage = 'plan'
  let folded = false
  let lastPts = null
  let lastGrade = null
  let cbs = { onCursorDistance: null, onSegmentDistance: null, onSegmentStep: null, onSegmentClear: null, onAdjustSegment: null, onExpand: null, onRetry: null, onRetryTerrain: null, onReturnPlan: null }
  let lastCursorDistanceM = null
  let selectedSegment = null
  let segmentComparison = null
  let profileReady = false
  let detailsOpen = false
  let terrainState = 'ready'
  let resilienceStatus = null
  let resilienceReason = null
  const setDetailsOpen = (open) => {
    detailsOpen = !!open
    details.hidden = !detailsOpen
    detailsToggle.setAttribute('aria-expanded', String(detailsOpen))
    detailsToggle.textContent = detailsOpen ? '收起路线详情' : '路线详情'
  }
  const setDetailsAvailable = (available) => {
    detailsToggle.hidden = !available
    detailsToggle.disabled = !available
    if (!available) setDetailsOpen(false)
  }
  detailsToggle.addEventListener('click', () => setDetailsOpen(!detailsOpen))
  recovery.addEventListener('click', () => (cbs.onRetry ?? cbs.onExpand)?.())
  returnPlan.addEventListener('click', () => cbs.onReturnPlan?.())
  retryTerrain.addEventListener('click', () => cbs.onRetryTerrain?.())
  terrainReturnPlan.addEventListener('click', () => cbs.onReturnPlan?.())
  const syncTerrainNotice = () => {
    const copy = {
      preparing: '正在准备地形视图；路线会保持可见。',
      fallback: '3D 地形暂不可用，正以 2D 保持路线。',
    }[terrainState]
    terrainNotice.hidden = !copy
    terrainNotice.textContent = copy ?? ''
    terrainActions.hidden = terrainState !== 'fallback'
    el.dataset.terrainState = terrainState
  }
  const formatGrade = (gradePct) => {
    const rounded = Math.round(gradePct * 10) / 10
    if (rounded > 0) return `上坡 +${rounded.toFixed(1)}%`
    if (rounded < 0) return `下坡 −${Math.abs(rounded).toFixed(1)}%`
    return '坡度 0.0%'
  }
  const clearSliderSemantics = () => {
    canvas.tabIndex = -1
    for (const name of ['role', 'aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) canvas.removeAttribute(name)
  }
  const enableSliderSemantics = () => {
    canvas.tabIndex = 0
    canvas.setAttribute('role', 'slider')
    canvas.setAttribute('aria-label', '路线高程剖面游标')
  }
  const syncSliderAvailability = () => {
    if (profileReady && stage === 'analyze') enableSliderSemantics()
    else clearSliderSemantics()
  }
  const syncVisibility = () => el.classList.toggle('hidden', stage !== 'analyze')
  head.onclick = () => {
    folded = !folded
    el.classList.toggle('folded', folded)
    head.setAttribute('aria-expanded', String(!folded))
    fold.textContent = folded ? '展开' : '收起'
  }
  const distanceAt = (e) => {
    if (!analysisPointsReady(lastPts)) return null
    const rect = canvas.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * canvas.width
    const fraction = Math.max(0, Math.min(1, (mx - 12) / (canvas.width - 24)))
    return lastPts[0].cumDistM + (lastPts.at(-1).cumDistM - lastPts[0].cumDistM) * fraction
  }
  const requestCursor = (distanceM) => {
    if (Number.isFinite(distanceM)) cbs.onCursorDistance?.(distanceM)
  }
  const comparisonValue = (value, unit, digits = 1) => Number.isFinite(value) ? `${value.toFixed(digits)} ${unit}` : '不可比较'
  const comparisonDelta = (value, unit, digits = 1) => {
    if (!Number.isFinite(value)) return '不可比较'
    if (value === 0) return '无变化'
    const direction = value > 0 ? '增加' : '减少'
    const sign = value > 0 ? '+' : '−'
    const threshold = 10 ** -digits
    if (Math.abs(value) < threshold) return `${direction} <${threshold.toFixed(digits)} ${unit}`
    return `${direction} ${sign}${Math.abs(value).toFixed(digits)} ${unit}`
  }
  const appendComparison = () => {
    if (segmentComparison?.status !== 'ready') {
      if (!segmentComparison?.notice) return false
      const notice = document.createElement('p')
      notice.className = 'profile-comparison-notice'
      notice.textContent = segmentComparison.notice
      segmentDetails.appendChild(notice)
      return true
    }
    const comparison = document.createElement('div')
    comparison.className = 'profile-segment-comparison'
    const heading = document.createElement('strong')
    heading.textContent = '调整前 / 当前 / 变化'
    comparison.appendChild(heading)
    const rows = [
      ['区间', comparisonValue(segmentComparison.before.distanceM / 1000, 'km'), comparisonValue(segmentComparison.current.distanceM / 1000, 'km'), comparisonDelta(segmentComparison.change.distanceM / 1000, 'km')],
      ['高程变化', comparisonValue(segmentComparison.before.elevationDeltaM, 'm', 0), comparisonValue(segmentComparison.current.elevationDeltaM, 'm', 0), comparisonDelta(segmentComparison.change.elevationDeltaM, 'm', 0)],
      ['净坡度', comparisonValue(segmentComparison.before.netGradePct, '%'), comparisonValue(segmentComparison.current.netGradePct, '%'), comparisonDelta(segmentComparison.change.netGradePct, '%')],
    ]
    if (Number.isFinite(segmentComparison.before.durationS) && Number.isFinite(segmentComparison.current.durationS)) {
      const minutes = (durationS) => Number.isFinite(durationS) ? durationS / 60 : null
      rows.push(['时长', comparisonValue(minutes(segmentComparison.before.durationS), '分钟', 0), comparisonValue(minutes(segmentComparison.current.durationS), '分钟', 0), comparisonDelta(minutes(segmentComparison.change.durationS), '分钟', 0)])
    }
    rows.forEach(([label, before, current, delta]) => {
      const row = document.createElement('p')
      row.textContent = `${label} · ${before} · ${current} · ${delta}`
      comparison.appendChild(row)
    })
    segmentDetails.appendChild(comparison)
    return true
  }
  const renderSegmentDetails = () => {
    segmentDetails.replaceChildren()
    if (!selectedSegment) {
      segmentDetails.hidden = !appendComparison()
      return
    }
    segmentDetails.hidden = false
    const fromName = selectedSegment.from?.name || '未命名点'
    const toName = selectedSegment.to?.name || '未命名点'
    const distanceM = selectedSegment.endM - selectedSegment.startM
    const start = sampleAnalysisAtDistance(lastPts, selectedSegment.startM)
    const end = sampleAnalysisAtDistance(lastPts, selectedSegment.endM)
    const deltaM = start && end ? end.ele - start.ele : null
    const netGrade = Number.isFinite(deltaM) && distanceM > 0 ? (deltaM / distanceM) * 100 : null
    const durationS = selectedSegment.leg?.durationS
    const rows = [
      [`第 ${selectedSegment.index + 1} 段 · ${fromName} → ${toName}`, null],
      ['区间', Number.isFinite(distanceM) ? `${(distanceM / 1000).toFixed(1)} km` : '区间暂不可用'],
      ['高程变化', Number.isFinite(deltaM) ? `${deltaM >= 0 ? '+' : '−'}${Math.abs(Math.round(deltaM)).toLocaleString('zh-CN')} m` : '高程暂不可用'],
      ['净坡度', Number.isFinite(netGrade) ? `${netGrade >= 0 ? '+' : '−'}${Math.abs(netGrade).toFixed(1)}%` : '坡度暂不可用'],
      ['时长', Number.isFinite(durationS) ? `${Math.max(1, Math.round(durationS / 60))} 分钟` : '时长暂不可用'],
    ]
    rows.forEach(([label, value], index) => {
      const row = document.createElement(index ? 'p' : 'strong')
      row.textContent = value == null ? label : `${label} · ${value}`
      segmentDetails.appendChild(row)
    })
    appendComparison()
    if (stage === 'analyze') {
      const adjust = document.createElement('button')
      adjust.type = 'button'
      adjust.className = 'profile-adjust-segment'
      adjust.textContent = '调整这一段'
      adjust.addEventListener('click', () => cbs.onAdjustSegment?.(selectedSegment))
      segmentDetails.appendChild(adjust)
    }
  }
  canvas.addEventListener('pointermove', (e) => {
    requestCursor(distanceAt(e))
  })
  canvas.addEventListener('pointerdown', (e) => {
    const distanceM = distanceAt(e)
    requestCursor(distanceM)
    if (Number.isFinite(distanceM)) cbs.onSegmentDistance?.(distanceM)
    canvas.focus()
  })
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') cbs.onCursorDistance?.(null)
  })
  canvas.addEventListener('keydown', (e) => {
    if (!analysisPointsReady(lastPts)) return
    if (e.key === 'Escape') {
      e.preventDefault()
      cbs.onSegmentClear?.()
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      cbs.onSegmentDistance?.(lastCursorDistanceM ?? lastPts[0].cumDistM)
      return
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      cbs.onSegmentStep?.(e.key === 'ArrowLeft' ? -1 : 1)
      const currentIndex = nearestAnalysisIndex(lastPts, lastCursorDistanceM ?? lastPts[0].cumDistM)
      const nextIndex = Math.max(0, Math.min(lastPts.length - 1, currentIndex + (e.key === 'ArrowLeft' ? -1 : 1)))
      requestCursor(lastPts[nextIndex].cumDistM)
      return
    }
    const currentIndex = nearestAnalysisIndex(lastPts, lastCursorDistanceM ?? lastPts[0].cumDistM)
    const nextIndex = e.key === 'Home' ? 0 : e.key === 'End' ? lastPts.length - 1 : null
    if (nextIndex == null) return
    e.preventDefault()
    requestCursor(lastPts[nextIndex].cumDistM)
  })
  const draw = () => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!analysisPointsReady(lastPts)) return
    const min = Math.min(...lastPts.map((point) => point.ele))
    const max = Math.max(...lastPts.map((point) => point.ele))
    const span = Math.max(max - min, 1)
    const { width: W, height: H } = canvas
    const startDistanceM = lastPts[0].cumDistM
    const totalDistanceM = lastPts.at(-1).cumDistM - startDistanceM
    const chartPoints = lastPts.map((point, index) => ({
      x: (index / (lastPts.length - 1)) * (W - 24) + 12,
      y: 8 + (1 - (point.ele - min) / span) * (H - 18),
    }))
    ctx.globalAlpha = .22
    ctx.fillStyle = accent
    ctx.beginPath()
    chartPoints.forEach((point, index) => {
      index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)
    })
    ctx.lineTo(chartPoints.at(-1).x, H - 5)
    ctx.lineTo(chartPoints[0].x, H - 5)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.beginPath()
    chartPoints.forEach((point, index) => {
      index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)
    })
    ctx.stroke()
    if (selectedSegment && Number.isFinite(selectedSegment.startM) && Number.isFinite(selectedSegment.endM)) {
      const start = totalDistanceM > 0 ? (selectedSegment.startM - startDistanceM) / totalDistanceM : 0
      const end = totalDistanceM > 0 ? (selectedSegment.endM - startDistanceM) / totalDistanceM : 1
      ctx.fillStyle = 'rgba(255, 79, 23, .22)'
      ctx.fillRect(12 + Math.max(0, start) * (W - 24), 5, Math.max(2, (end - start) * (W - 24)), H - 10)
    }
    const sample = sampleAnalysisAtDistance(lastPts, lastCursorDistanceM)
    if (!sample) {
      cursorReadout.textContent = ''
      canvas.removeAttribute('aria-valuemin')
      canvas.removeAttribute('aria-valuemax')
      canvas.removeAttribute('aria-valuenow')
      canvas.removeAttribute('aria-valuetext')
      return
    }
    const fraction = totalDistanceM > 0 ? (sample.distanceM - startDistanceM) / totalDistanceM : 0
    const x = 12 + fraction * (W - 24)
    const y = 8 + (1 - (sample.ele - min) / span) * (H - 18)
    ctx.strokeStyle = 'rgba(255,255,255,.62)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, H - 5); ctx.stroke()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
    const distanceText = `${(sample.distanceM / 1000).toFixed(1)} km`
    const gradePct = sampleRouteGradeAtDistance(lastGrade, sample.distanceM)
    const valueText = `${distanceText} · ${Math.round(sample.ele).toLocaleString('zh-CN')} m${gradePct == null ? '' : ` · ${formatGrade(gradePct)}`}`
    cursorReadout.textContent = valueText
    if (profileReady && stage === 'analyze') {
      canvas.setAttribute('aria-valuemin', String(Math.round(startDistanceM)))
      canvas.setAttribute('aria-valuemax', String(Math.round(lastPts.at(-1).cumDistM)))
      canvas.setAttribute('aria-valuenow', String(Math.round(sample.distanceM)))
      canvas.setAttribute('aria-valuetext', valueText)
    }
  }
  return {
    el,
    setStage(next) {
      stage = next === 'analyze' ? 'analyze' : 'plan'
      syncSliderAvailability()
      renderSegmentDetails()
      if (profileReady) draw()
      syncVisibility()
    },
    setTerrainState(next) {
      terrainState = ['preparing', 'fallback'].includes(next) ? next : 'ready'
      syncTerrainNotice()
      syncVisibility()
    },
    setResilience(next) {
      resilienceStatus = next?.status ?? null
      resilienceReason = next?.reason ?? null
    },
    setCallbacks(next) { cbs = { ...cbs, ...next } },
    setCursorDistance(distanceM) {
      lastCursorDistanceM = Number.isFinite(distanceM) ? distanceM : null
      draw()
    },
    setSelectedSegment(next) {
      selectedSegment = next ?? null
      renderSegmentDetails()
      draw()
    },
    setSegmentComparison(next) {
      segmentComparison = next?.status || next?.notice ? next : null
      comparisonLive.textContent = segmentComparison?.status === 'ready'
        ? '调整前与当前已可比较。'
        : (segmentComparison?.notice ?? '')
      renderSegmentDetails()
    },
    update(analysis = {}, presentation = null) {
      resilienceStatus = presentation?.status ?? resilienceStatus
      resilienceReason = presentation?.reason ?? resilienceReason
      const status = resilienceStatus ?? analysis.status ?? 'failed'
      const ready = status === 'ready' || status === 'fallback-ready'
        ? analysis.status === 'ready' && analysisPointsReady(analysis.points) && analysis.profile
        : false
      el.dataset.status = status
      metrics.replaceChildren()
      if (!ready) {
        profileReady = false
        lastPts = null
        lastGrade = null
        lastCursorDistanceM = null
        selectedSegment = null
        renderSegmentDetails()
        canvas.classList.add('hidden')
        metrics.replaceChildren()
        source.textContent = ''
        setDetailsAvailable(false)
        const legacyRecoverable = ['dem-unavailable', 'outside-coverage', 'route-terrain-unavailable', 'route-terrain-budget', 'route-terrain-cancelled'].includes(status)
        const retryable = resilienceStatus ? ['stale', 'failed'].includes(status) : legacyRecoverable
        const canReturnPlan = resilienceStatus ? ['preparing', 'stale', 'failed'].includes(status) : legacyRecoverable
        const failure = {
          'outside-coverage': { message: '路线地形尚未补齐。', action: '补齐路线地形' },
          'route-terrain-budget': { message: '路线较长，暂时无法补齐完整地形。', action: '重新分析' },
          'route-terrain-cancelled': { message: '路线已变化，分析已取消，请重新分析。', action: '重新分析' },
          'budget-exceeded': { message: '路线较长，暂时无法补齐完整地形。', action: '重新分析' },
          'dem-unavailable': { message: '路线分析暂不可用，请检查网络后重新分析。', action: '重新分析' },
          'route-terrain-unavailable': { message: '路线分析暂不可用，请检查网络后重新分析。', action: '重新分析' },
        }[resilienceReason] ?? { message: '路线分析暂不可用，请稍后重新分析。', action: '重新分析' }
        recoveryActions.hidden = !canReturnPlan
        recovery.hidden = !retryable
        returnPlan.hidden = !canReturnPlan
        recovery.textContent = resilienceStatus ? (status === 'failed' ? failure.action : '重新分析') : (status === 'outside-coverage' ? '补齐路线地形' : '重试')
        statusMessage.textContent = {
          incomplete: '至少添加起点和终点',
          preparing: '正在准备路线分析；可随时返回规划。',
          stale: '路线已变化，需要重新分析。',
          failed: failure.message,
          'outside-coverage': '路线地形尚未补齐',
          'dem-unavailable': '高程数据暂不可用',
          'route-terrain-loading': '正在准备路线分析',
          'route-terrain-unavailable': '路线地形暂不可用',
          'route-terrain-budget': '路线较长，暂时无法补齐完整地形',
          'route-terrain-cancelled': '路线已变化，地形补齐已取消',
        }[status] ?? '路线分析暂不可用，请重新分析。'
        syncSliderAvailability()
        cursorReadout.textContent = ''
        syncVisibility()
        return
      }
      const { points, profile, grade } = analysis
      if (!profileReady) setDetailsOpen(false)
      profileReady = true
      lastPts = points
      lastGrade = grade
      renderSegmentDetails()
      canvas.classList.remove('hidden')
      recoveryActions.hidden = true
      recovery.hidden = true
      returnPlan.hidden = true
      setDetailsAvailable(true)
      statusMessage.textContent = `${(profile.distanceM / 1000).toFixed(1)} km · ${grade?.status === 'ready' ? '高程可用' : '高程部分可用'}`
      source.textContent = grade?.status === 'ready'
        ? '原始高程与局部坡度分析'
        : '坡度不可用：有效水平距离或高程覆盖不足'
      for (const text of [
        `最低 ${Math.round(profile.minElevationM).toLocaleString('zh-CN')} m`,
        `最高 ${Math.round(profile.maxElevationM).toLocaleString('zh-CN')} m`,
      ]) {
        const item = document.createElement('span')
        item.textContent = text
        metrics.appendChild(item)
      }
      if (grade?.status === 'ready') {
        for (const text of [
          `平均绝对坡度 ${grade.averageAbsPct.toFixed(1)}%`,
          `最大上坡 ${grade.maxUphillPct == null ? '—' : `+${grade.maxUphillPct.toFixed(1)}%`}`,
          `最大下坡 ${grade.maxDownhillPct == null ? '—' : `−${Math.abs(grade.maxDownhillPct).toFixed(1)}%`}`,
        ]) {
          const item = document.createElement('span')
          item.textContent = text
          metrics.appendChild(item)
        }
      }
      syncSliderAvailability()
      draw()
      syncVisibility()
    },
  }
}
