// Context panel contents + profile floating card. DOM only; fed by main.js.
import { durationContract, normalizeRouteMode } from '../lib/routePlanning.js'
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

  // Search is owned by the command bar. Results stay in the drawer so the map
  // remains visible while a user chooses where to go or add a point.
  const results = document.createElement('div')
  results.className = 'pp-results hidden'
  const attr = document.createElement('div')
  attr.className = 'pp-attr'
  attr.textContent = '© OpenStreetMap contributors'
  results.appendChild(attr)
  el.appendChild(results)

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

  const journeyList = document.createElement('div')
  journeyList.className = 'pp-journey-list'
  journeyList.setAttribute('aria-label', '按天行程列表')
  let selectedDay = 1

  const wpList = document.createElement('div')
  wpList.className = 'ui-wp-list pp-tl'
  el.appendChild(wpList)

  const stat = document.createElement('div')
  stat.className = 'ui-stat-card pp-plan'

  // collapsible per-leg details
  const legsBox = document.createElement('div')
  legsBox.className = 'pp-legs hidden'
  const legsHead = document.createElement('button')
  legsHead.className = 'pp-legs-head'
  legsHead.textContent = '逐段详情 ▾'
  const legsList = document.createElement('div')
  legsList.className = 'pp-legs-list'
  legsHead.onclick = () => legsList.classList.toggle('hidden')
  legsBox.append(legsHead, legsList)

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
  el.replaceChildren(results, nameSection, name, routeSection, snapRow, wpList, secondary, opsMain, mobilePrimary)

  return {
    el,
    get nameEl() { return name },
    // update(route, stats, legs, weatherIndex, profile) — timeline list + summary card + legs
    update(route, stats, legs = null, weatherIndex = null, profile = 'foot', weatherDays = null) {
      if (document.activeElement !== name) name.value = route.name
      wpList.replaceChildren()
      const n = route.waypoints.length
      mobileSave.disabled = n < 2
      save.disabled = n < 2
      journeyList.replaceChildren()
      if (n >= 2) {
        const endIndexes = (route.dayEnds ?? [])
          .map((id) => route.waypoints.findIndex((point) => point.id === id))
          .filter((index) => index > 0 && index < n - 1)
          .sort((a, b) => a - b)
        const boundaries = [...endIndexes, n - 1]
        journeyList.classList.toggle('hidden', boundaries.length <= 1)
        let startIndex = 0
        boundaries.forEach((endIndex, dayIndex) => {
          const day = dayIndex + 1
          const dayLegs = (legs ?? []).slice(startIndex, endIndex)
          const distanceM = dayLegs.length
            ? dayLegs.reduce((sum, leg) => sum + (Number(leg.distanceM) || 0), 0)
            : null
          const durationS = dayLegs.length && dayLegs.every((leg) => leg.real && Number.isFinite(leg.durationS))
            ? dayLegs.reduce((sum, leg) => sum + leg.durationS, 0)
            : null
          const weather = weatherDays?.[dayIndex]
          const row = document.createElement('button')
          row.type = 'button'
          row.className = 'pp-journey-row'
          row.classList.toggle('selected', selectedDay === day)
          row.setAttribute('aria-pressed', String(selectedDay === day))
          const dayCell = document.createElement('span')
          dayCell.className = 'pp-journey-day'
          const dayName = document.createElement('b')
          dayName.textContent = `D${day}`
          const dayDate = document.createElement('small')
          dayDate.textContent = weather?.date?.slice?.(5) ?? ''
          dayCell.append(dayName, dayDate)
          const routeCell = document.createElement('span')
          routeCell.className = 'pp-journey-route'
          const from = document.createElement('b')
          from.textContent = route.waypoints[startIndex].name
          const arrow = document.createElement('i')
          arrow.textContent = '→'
          const to = document.createElement('b')
          to.textContent = route.waypoints[endIndex].name
          routeCell.append(from, arrow, to)
          const distanceCell = document.createElement('span')
          distanceCell.className = 'pp-journey-metric'
          distanceCell.textContent = distanceM == null ? '—' : `${(distanceM / 1000).toFixed(1)} km`
          const durationCell = document.createElement('span')
          durationCell.className = 'pp-journey-metric'
          durationCell.textContent = durationS == null ? '—' : fmtDur(durationS / 60)
          const weatherCell = document.createElement('span')
          weatherCell.className = 'pp-journey-weather'
          weatherCell.textContent = weather ? `${Math.round(weather.tempMin)}–${Math.round(weather.tempMax)}°C · ${weather.precipMm.toFixed(1)}mm` : '天气未加载'
          row.append(dayCell, routeCell, distanceCell, durationCell, weatherCell)
          row.onclick = () => {
            selectedDay = day
            actions.onDaySelect?.({ day, startIndex, endIndex })
            for (const button of journeyList.querySelectorAll('.pp-journey-row')) {
              const active = button === row
              button.classList.toggle('selected', active)
              button.setAttribute('aria-pressed', String(active))
            }
          }
          journeyList.appendChild(row)
          startIndex = endIndex
        })
      } else journeyList.classList.add('hidden')
      // loop route: last point within ~25m of the first → merged start/end marker
      const wpsArr = route.waypoints
      const isLoop = n > 1 && Math.hypot(wpsArr[0].lon - wpsArr[n - 1].lon, wpsArr[0].lat - wpsArr[n - 1].lat) < 0.0003
      route.waypoints.forEach((w, i) => {
        const item = document.createElement('div')
        item.className = 'pp-tl-item'
        const role = i === 0 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'via'

        const rail = document.createElement('div')
        rail.className = 'pp-tl-rail'
        const dot = document.createElement('span')
        dot.className = `pp-tl-dot ${role}`
        rail.appendChild(dot)
        if (i < n - 1) {
          const line = document.createElement('span')
          line.className = 'pp-tl-line'
          rail.appendChild(line)
        }

        const body = document.createElement('div')
        body.className = 'pp-tl-body'
        const roleLabel = document.createElement('b')
        roleLabel.className = 'pp-tl-role'
        roleLabel.textContent = role === 'start' ? '起点' : role === 'end' ? '终点' : '途经点'
        const nm = document.createElement('span')
        nm.className = 'pp-tl-name'
        nm.textContent = isLoop && i === n - 1 ? `${w.name}(环线终点)` : w.name
        // day badge from dayEnds (multi-day segmentation)
        const day = actions.dayNumberAt?.(i) ?? 1
        const badge = document.createElement('span')
        badge.className = 'pp-day-badge'
        badge.textContent = `D${day}`
        nm.prepend(badge)
        nm.title = '双击重命名'
        nm.ondblclick = () => {
          const inp = document.createElement('input')
          inp.className = 'pp-tl-rename'
          inp.value = w.name
          nm.replaceWith(inp)
          inp.focus()
          inp.select()
          let done = false // Enter commits → re-render detaches input → blur must not re-commit
          const commit = () => {
            if (done) return
            done = true
            actions.onWpRename?.(i, inp.value.trim() || w.name)
          }
          inp.onkeydown = (e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { done = true; inp.replaceWith(nm) }
          }
          inp.onblur = commit
        }
        const coord = document.createElement('span')
        coord.className = 'pp-tl-coord'
        coord.textContent = `${w.lon.toFixed(4)}, ${w.lat.toFixed(4)} · ${Math.round(w.ele)}m`
        const ops = document.createElement('span')
        ops.className = 'pp-tl-ops'
        const mkOp = (label, title, fn) => {
          const b = document.createElement('button')
          b.textContent = label
          b.title = title
          b.onclick = fn
          ops.appendChild(b)
        }
        if (i > 0) mkOp('↑', '上移', () => actions.onWpMove?.(i, -1))
        if (i < n - 1) mkOp('↓', '下移', () => actions.onWpMove?.(i, 1))
        if (i < n - 1) mkOp('☀', '设为/取消此天终点(多日分段)', () => actions.onToggleDayEnd?.(i))
        mkOp('✕', '删除', () => actions.onWpRemove?.(i))
        body.append(roleLabel, nm, coord, ops)
        item.append(rail, body)
        // drag-sort: HTML5 DnD between timeline rows
        item.draggable = true
        item.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move' }
        item.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
        item.ondrop = (e) => {
          e.preventDefault()
          const from = +e.dataTransfer.getData('text/plain')
          if (Number.isInteger(from)) actions.onWpMoveTo?.(from, i)
        }
        wpList.appendChild(item)
        // between-row insert divider
        if (i < n - 1) {
          const sep = document.createElement('div')
          sep.className = 'pp-tl-sep'
          const add = document.createElement('button')
          add.textContent = '⊕'
          add.title = '在此插入途经点(下一次地形点击落在此处)'
          add.onclick = () => actions.onInsertAt?.(i + 1)
          sep.appendChild(add)
          wpList.appendChild(sep)
        }
      })

      const addPoint = document.createElement('button')
      addPoint.type = 'button'
      addPoint.className = 'pp-add-waypoint'
      addPoint.textContent = '＋ 增加途经点'
      addPoint.onclick = () => actions.onInsertAt?.(n)
      wpList.appendChild(addPoint)

      stat.replaceChildren()
      if (!n) {
        stat.innerHTML = '<span class="disclaimer">点击地形落第一个途经点</span>'
        legsBox.classList.add('hidden')
        return
      }
      const km = stats && stats.distanceM ? (stats.distanceM / 1000).toFixed(1) : '0.0'
      const duration = durationContract({ mode: route.mode, legs: legs ?? [], stats })
      const summary = document.createElement('span')
      summary.className = 'pp-plan-summary'
      summary.textContent = `${km} km · ${n} 点 · ${duration.label} ${duration.minutes == null ? '—' : fmtDur(duration.minutes)}`
      if (stats && [stats.ascentM, stats.descentM, stats.maxEle].every(Number.isFinite)) {
        summary.textContent += ` · ↑${stats.ascentM}m ↓${stats.descentM}m · 最高 ${stats.maxEle}m`
      }
      if (weatherIndex != null) summary.textContent += ` · 天气指数 ${weatherIndex}`
      stat.appendChild(summary)

      // per-leg details
      if (legs?.length) {
        legsBox.classList.remove('hidden')
        legsList.replaceChildren()
        legs.forEach((l, i) => {
          const r = document.createElement('div')
          r.className = 'pp-leg'
          const dur = l.real ? ` ${fmtDur(l.durationS / 60)}` : ' 直线回退'
          const ele = l.ascentM != null ? ` ↑${l.ascentM}m ↓${l.descentM}m` : ''
          const shade = l.shade != null ? ` · 遮阴${Math.round(l.shade * 100)}%` : ''
          r.textContent = `${i + 1}. ${l.from} → ${l.to} · ${(l.distanceM / 1000).toFixed(1)}km${ele}${dur}${l.real ? ' (路网)' : ''}${shade}`
          legsList.appendChild(r)
        })
      } else {
        legsBox.classList.add('hidden')
      }
    },

    // ---- shared search session: command bar owns input; this surface owns its one result/selection view.
    setSearchSession(session) {
      results.classList.remove('hidden')
      results.setAttribute('aria-live', 'polite')
      results.setAttribute('aria-busy', String(session?.state === 'searching'))
      results.replaceChildren()
      const status = document.createElement('p')
      status.className = `pp-search-status ${session?.state === 'error' ? 'is-error' : ''}`
      status.textContent = session?.message ?? '搜索地点、线路或营地'
      results.appendChild(status)
      if (session?.state === 'place-selection' && session.selected) {
        const place = session.selected
        const card = document.createElement('section')
        card.className = 'pp-place-selection'
        const name = document.createElement('b')
        name.textContent = place.name
        const detail = document.createElement('span')
        detail.textContent = `${place.context} · ${place.category}`
        const actionsRow = document.createElement('div')
        actionsRow.className = 'pp-place-actions'
        for (const [role, label, primary] of [
          ['start', '设为起点', true], ['end', '设为终点', false], ['via', '添加途经点', false], ['view', '仅查看地点', false],
        ]) {
          const button = document.createElement('button')
          button.type = 'button'
          button.textContent = label
          if (primary) button.className = 'primary'
          button.addEventListener('click', () => actions.onSearchRole?.(role))
          actionsRow.appendChild(button)
        }
        card.append(name, detail, actionsRow)
        results.appendChild(card)
        results.appendChild(attr)
        return
      }
      if (session?.state === 'results') {
        for (const place of session.results) {
          const row = document.createElement('button')
          row.type = 'button'
          row.className = 'pp-result'
          const copy = document.createElement('span')
          copy.className = 'pp-result-copy'
          const name = document.createElement('b')
          name.textContent = place.name
          const context = document.createElement('span')
          context.textContent = place.context
          copy.append(name, context)
          const category = document.createElement('small')
          category.textContent = place.category
          row.append(copy, category)
          row.addEventListener('click', () => actions.onSearchSelect?.(place))
          results.appendChild(row)
        }
      }
      results.appendChild(attr) // OSM attribution always visible with results
    },
    setSearchBusy(on) { results.setAttribute('aria-busy', String(on)) },
    setSearchResults(list, query) { this.setSearchSession({ state: list.length ? 'results' : 'empty', results: list, message: list.length ? `找到 ${list.length} 个地点，请先确认城市或区县` : `未找到「${query}」` }) },
    hideSearchResults() { results.classList.add('hidden') },
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
  details.append(metrics, source)
  status.append(statusMessage, cursorReadout)
  body.append(status, recoveryActions, canvas, detailsToggle, details)
  el.append(head, body)
  document.body.appendChild(el)
  let stage = 'plan'
  let folded = false
  let lastPts = null
  let lastGrade = null
  let cbs = { onCursorDistance: null, onExpand: null, onRetry: null, onReturnPlan: null }
  let lastCursorDistanceM = null
  let profileReady = false
  let detailsOpen = false
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
  canvas.addEventListener('pointermove', (e) => {
    requestCursor(distanceAt(e))
  })
  canvas.addEventListener('pointerdown', (e) => {
    requestCursor(distanceAt(e))
  })
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') cbs.onCursorDistance?.(null)
  })
  canvas.addEventListener('keydown', (e) => {
    if (!analysisPointsReady(lastPts)) return
    const currentIndex = nearestAnalysisIndex(lastPts, lastCursorDistanceM ?? lastPts[0].cumDistM)
    let nextIndex = currentIndex
    if (e.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1)
    else if (e.key === 'ArrowRight') nextIndex = Math.min(lastPts.length - 1, currentIndex + 1)
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = lastPts.length - 1
    else return
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
    const sample = sampleAnalysisAtDistance(lastPts, lastCursorDistanceM)
    if (!sample) {
      cursorReadout.textContent = ''
      canvas.removeAttribute('aria-valuemin')
      canvas.removeAttribute('aria-valuemax')
      canvas.removeAttribute('aria-valuenow')
      canvas.removeAttribute('aria-valuetext')
      return
    }
    const startDistanceM = lastPts[0].cumDistM
    const totalDistanceM = lastPts.at(-1).cumDistM - startDistanceM
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
      if (profileReady) draw()
      syncVisibility()
    },
    setCallbacks(next) { cbs = { ...cbs, ...next } },
    setCursorDistance(distanceM) {
      lastCursorDistanceM = Number.isFinite(distanceM) ? distanceM : null
      draw()
    },
    update(analysis = {}) {
      const ready = analysis.status === 'ready' && analysisPointsReady(analysis.points) && analysis.profile
      el.dataset.status = analysis.status ?? 'dem-unavailable'
      metrics.replaceChildren()
      if (!ready) {
        profileReady = false
        lastPts = null
        lastGrade = null
        lastCursorDistanceM = null
        canvas.classList.add('hidden')
        metrics.replaceChildren()
        source.textContent = ''
        setDetailsAvailable(false)
        const recoverable = ['outside-coverage', 'route-terrain-unavailable', 'route-terrain-budget', 'route-terrain-cancelled'].includes(analysis.status)
        recoveryActions.hidden = !recoverable
        recovery.hidden = !recoverable
        returnPlan.hidden = !recoverable
        recovery.textContent = analysis.status === 'outside-coverage' ? '补齐路线地形' : '重试'
        statusMessage.textContent = {
          incomplete: '至少添加起点和终点',
          'outside-coverage': '路线地形尚未补齐',
          'dem-unavailable': '高程数据暂不可用',
          'route-terrain-loading': '路线地形 · 正在补齐',
          'route-terrain-unavailable': '路线地形暂不可用',
          'route-terrain-budget': '路线较长，暂时无法补齐完整地形',
          'route-terrain-cancelled': '路线已变化，地形补齐已取消',
        }[analysis.status] ?? '高程数据暂不可用'
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
      canvas.classList.remove('hidden')
      recoveryActions.hidden = true
      recovery.hidden = true
      returnPlan.hidden = true
      setDetailsAvailable(true)
      statusMessage.textContent = `${(profile.distanceM / 1000).toFixed(1)} km · 高程可用`
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
