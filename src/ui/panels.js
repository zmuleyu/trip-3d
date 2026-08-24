// Context panel contents + profile floating card. DOM only; fed by main.js.
import { bandColumns } from '../lib/weather.js'
import { durationContract, normalizeRouteMode } from '../lib/routePlanning.js'

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

    // ---- search API (explicit trigger; results rendered with ⊕ add buttons)
    setSearchBusy(on) { results.setAttribute('aria-busy', String(on)) },
    setSearchResults(list, query) {
      results.classList.remove('hidden')
      results.replaceChildren()
      if (!list.length) {
        const e = document.createElement('div')
        e.className = 'pp-empty'
        e.textContent = `未找到「${query}」`
        results.appendChild(e)
      }
      for (const r of list) {
        const row = document.createElement('div')
        row.className = 'pp-result'
        const txt = document.createElement('span')
        txt.className = 'pp-result-name'
        txt.textContent = r.name || r.displayName.split(',')[0]
        txt.title = r.displayName
        row.appendChild(txt)
        const go = document.createElement('button')
        go.textContent = '飞达'
        go.onclick = () => actions.onSearchGo?.(r)
        const add = document.createElement('button')
        add.textContent = '⊕加点'
        add.className = 'primary'
        add.onclick = () => actions.onSearchAdd?.(r)
        row.append(go, add)
        results.appendChild(row)
      }
      results.appendChild(attr) // OSM attribution always visible with results
    },
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
  const el = document.createElement('div')
  el.className = 'ui-profile hidden'
  const head = document.createElement('div')
  head.className = 'head'
  const title = document.createElement('span')
  title.textContent = '高程剖面'
  const fold = document.createElement('span')
  fold.className = 'fold'
  fold.textContent = '收起 ▾'
  head.append(title, fold)
  const canvas = document.createElement('canvas')
  canvas.width = 596
  canvas.height = 110
  el.append(head, canvas)
  document.body.appendChild(el)
  let folded = false
  let lastPts = null
  let cbs = { onHover: null, onSelect: null }
  head.onclick = () => {
    folded = !folded
    el.classList.toggle('folded', folded)
    fold.textContent = folded ? '展开 ▸' : '收起 ▾'
  }
  const indexAt = (e) => {
    if (!lastPts || lastPts.length < 2) return null
    const rect = canvas.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * canvas.width
    const i = Math.round(((mx - 10) / (canvas.width - 20)) * (lastPts.length - 1))
    return Math.max(0, Math.min(lastPts.length - 1, i))
  }
  canvas.addEventListener('mousemove', (e) => {
    const i = indexAt(e)
    if (i != null) cbs.onHover?.(i)
  })
  canvas.addEventListener('mouseleave', () => cbs.onHover?.(null))
  canvas.addEventListener('click', (e) => {
    const i = indexAt(e)
    if (i != null) cbs.onSelect?.(i)
  })
  return {
    el,
    setCallbacks(next) { cbs = { ...cbs, ...next } },
    // weatherDays (optional): aggregated TripWeatherDay[] — when provided, a
    // trip-day-axis band is drawn above the profile; when omitted, band clears.
    update(stats, pts, weatherDays, dayBounds) {
      if (!pts || pts.length < 2) {
        el.classList.add('hidden')
        lastPts = null
        return
      }
      lastPts = pts
      el.classList.remove('hidden')
      title.textContent = `高程剖面 · ${(stats.distanceM / 1000).toFixed(1)} km · 最高 ${stats.maxEle}m`
      const ctx = canvas.getContext('2d')
      const { width: W, height: H } = canvas
      ctx.clearRect(0, 0, W, H)
      const BAND_H = 12
      const hasBand = Array.isArray(weatherDays) && weatherDays.length > 0
      const bandTop = 2
      const profileTop = hasBand ? bandTop + BAND_H + 6 : bandTop
      // trip-day band: segmented by route-day fractions when dayEnds exist
      if (hasBand) {
        const cols = bandColumns(dayBounds, weatherDays.length)
        for (const c of cols) {
          const d = weatherDays[c.dayIndex]
          const x = 10 + c.x0 * (W - 20)
          const w = Math.max((c.x1 - c.x0) * (W - 20) - 1, 1)
          ctx.fillStyle = !d ? 'rgba(23,25,27,0.12)' : d.isRain ? 'rgba(74,144,217,0.55)' : 'rgba(240,234,214,0.7)'
          ctx.fillRect(x, bandTop, w, BAND_H)
          if (d && (weatherDays.length <= 8 || c.dayIndex === 0 || c.dayIndex === weatherDays.length - 1)) {
            ctx.fillStyle = '#17191b'
            ctx.font = '8px monospace'
            ctx.textAlign = 'center'
            ctx.fillText(d.date.slice(5), x + w / 2, bandTop + 9)
          }
        }
        ctx.textAlign = 'left'
      }
      // elevation profile
      const eles = pts.map((p) => p.ele)
      const min = Math.min(...eles), max = Math.max(...eles), span = Math.max(max - min, 1)
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = (i / (pts.length - 1)) * (W - 20) + 10
        const yy = profileTop + (1 - (p.ele - min) / span) * (H - 16 - profileTop)
        i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)
      })
      ctx.stroke()
      // day boundary separators (multi-day segmentation): accent dashed verticals
      if (Array.isArray(dayBounds) && dayBounds.length) {
        ctx.save()
        ctx.strokeStyle = accent
        ctx.globalAlpha = 0.75
        ctx.setLineDash([3, 3])
        ctx.lineWidth = 1
        for (const b of dayBounds) {
          const x = 10 + b.frac * (W - 20)
          ctx.beginPath()
          ctx.moveTo(x, profileTop - 2)
          ctx.lineTo(x, H - 6)
          ctx.stroke()
          ctx.fillText(`D${b.day}`, x + 2, profileTop + 8)
        }
        ctx.restore()
      }
      ctx.fillStyle = '#17191b'
      ctx.font = '10px monospace'
      ctx.fillText(`${Math.round(min)} m`, 10, H - 4)
      ctx.fillText(`${Math.round(max)} m`, 10, profileTop + 10)
    },
  }
}
