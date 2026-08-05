// Context panel contents + profile floating card. DOM only; fed by main.js.

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

  // ---- place search (explicit trigger only — Nominatim policy bans autocomplete)
  const searchWrap = document.createElement('div')
  searchWrap.className = 'pp-search'
  const searchInput = document.createElement('input')
  searchInput.placeholder = '搜索地点(如 四姑娘山)…'
  const searchBtn = document.createElement('button')
  searchBtn.textContent = '搜索'
  searchBtn.className = 'pp-search-btn'
  searchWrap.append(searchInput, searchBtn)
  const results = document.createElement('div')
  results.className = 'pp-results hidden'
  const attr = document.createElement('div')
  attr.className = 'pp-attr'
  attr.textContent = '© OpenStreetMap contributors'
  results.appendChild(attr)
  el.append(searchWrap, results)

  const doSearch = () => actions.onSearch?.(searchInput.value)
  searchBtn.onclick = doSearch
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch() })

  // ---- snap toggle + profile
  const snapRow = document.createElement('label')
  snapRow.className = 'pp-snap-row'
  const snapCb = document.createElement('input')
  snapCb.type = 'checkbox'
  snapRow.append(snapCb, ' 路网吸附')
  const snapProfile = document.createElement('select')
  snapProfile.className = 'pp-snap-profile'
  snapProfile.innerHTML = '<option value="foot">步行</option><option value="car">驾车</option>'
  snapRow.appendChild(snapProfile)
  const snapStatus = document.createElement('span')
  snapStatus.className = 'pp-snap-status'
  snapRow.appendChild(snapStatus)
  snapCb.onchange = () => actions.onSnapToggle?.(snapCb.checked)
  snapProfile.onchange = () => actions.onSnapProfile?.(snapProfile.value)
  el.appendChild(snapRow)

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
  const amapGo = document.createElement('button')
  amapGo.textContent = '导入'
  amapGo.className = 'primary'
  amapBox.append(amapInput, amapGo)
  amapRow.appendChild(amapBox)
  amapToggle.onclick = () => amapBox.classList.toggle('hidden')
  amapGo.onclick = () => actions.onImportAmap?.(amapInput.value)
  el.appendChild(amapRow)

  const name = document.createElement('input')
  name.className = 'name-input'
  name.value = '未命名线路'
  name.onchange = () => actions.onNameChange(name.value)
  el.appendChild(name)

  const wpList = document.createElement('div')
  wpList.className = 'ui-wp-list pp-tl'
  el.appendChild(wpList)

  const stat = document.createElement('div')
  stat.className = 'ui-stat-card pp-plan'
  el.appendChild(stat)

  // collapsible per-leg details
  const legsBox = document.createElement('div')
  legsBox.className = 'pp-legs hidden'
  const legsHead = document.createElement('button')
  legsHead.className = 'pp-legs-head'
  legsHead.textContent = '详情 ▾'
  const legsList = document.createElement('div')
  legsList.className = 'pp-legs-list'
  legsHead.onclick = () => legsList.classList.toggle('hidden')
  legsBox.append(legsHead, legsList)
  el.appendChild(legsBox)

  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.textContent = '点击地形继续加点 · ESC 退出规划'
  el.appendChild(hint)

  const row = document.createElement('div')
  row.className = 'ui-btn-row'
  const mk = (label, fn, primary = false) => {
    const b = document.createElement('button')
    b.textContent = label
    if (primary) b.classList.add('primary')
    b.onclick = fn
    row.appendChild(b)
  }
  mk('撤销', actions.onUndo)
  mk('清空', actions.onClear)
  mk('保存', actions.onSave, true)
  mk('分享链接', actions.onShare)
  mk('高德链接', actions.onExportAmap)
  mk('导出GPX', actions.onExportGpx)
  mk('导入GPX', actions.onImportGpx)
  el.appendChild(row)

  return {
    el,
    get nameEl() { return name },
    // update(route, stats, legs, weatherIndex, profile) — timeline list + summary card + legs
    update(route, stats, legs = null, weatherIndex = null, profile = 'foot') {
      if (document.activeElement !== name) name.value = route.name
      wpList.replaceChildren()
      const n = route.waypoints.length
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
        const nm = document.createElement('span')
        nm.className = 'pp-tl-name'
        nm.textContent = isLoop && i === n - 1 ? `${w.name}(环线终点)` : w.name
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
        mkOp('✕', '删除', () => actions.onWpRemove?.(i))
        body.append(nm, coord, ops)
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

      stat.replaceChildren()
      if (!n) {
        stat.innerHTML = '<span class="disclaimer">点击地形落第一个途经点</span>'
        legsBox.classList.add('hidden')
        return
      }
      const km = stats && stats.distanceM ? (stats.distanceM / 1000).toFixed(1) : '0.0'
      const big = document.createElement('div')
      big.className = 'pp-plan-big'
      const allReal = legs?.length && legs.every((l) => l.real)
      if (allReal) {
        // real routed duration (OSRM legs) — consistent with the per-leg details
        const totalS = legs.reduce((s, l) => s + l.durationS, 0)
        big.textContent = fmtDur(totalS / 60)
      } else if (stats) {
        big.textContent = fmtDur(stats.driveMinutes)
      } else {
        big.textContent = `${km} km`
      }
      const sub = document.createElement('div')
      sub.className = 'pp-plan-sub'
      sub.textContent = `${km} km · ${n} 点`
      if (stats) sub.textContent += ` · ↑${stats.ascentM}m ↓${stats.descentM}m · 最高 ${stats.maxEle}m`
      if (weatherIndex != null) sub.textContent += ` · 天气指数 ${weatherIndex}`
      const d = document.createElement('span')
      d.className = 'disclaimer'
      d.textContent = allReal ? `(${profile === 'car' ? '驾车' : '步行'}路网时长,非导航)` : '(示意,非导航)'
      sub.appendChild(d)
      stat.append(big, sub)

      // per-leg details
      if (legs?.length) {
        legsBox.classList.remove('hidden')
        legsList.replaceChildren()
        legs.forEach((l, i) => {
          const r = document.createElement('div')
          r.className = 'pp-leg'
          const dur = l.real
            ? ` ${fmtDur(l.durationS / 60)}`
            : ` ~${fmtDur(l.driveMinutes)}`
          const ele = l.ascentM != null ? ` ↑${l.ascentM}m ↓${l.descentM}m` : ''
          r.textContent = `${i + 1}. ${l.from} → ${l.to} · ${(l.distanceM / 1000).toFixed(1)}km${ele}${dur}${l.real ? ' (路网)' : ''}`
          legsList.appendChild(r)
        })
      } else {
        legsBox.classList.add('hidden')
      }
    },

    // ---- search API (explicit trigger; results rendered with ⊕ add buttons)
    setSearchBusy(on) {
      searchBtn.disabled = on
      searchBtn.textContent = on ? '…' : '搜索'
    },
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

    // ---- snap API
    setSnapState(on, statusText, profile) {
      snapCb.checked = on
      snapStatus.textContent = statusText ?? ''
      if (profile) snapProfile.value = profile
    },
  }
}

// ---------------------------------------------------------------- library panel
export function createLibraryPanel(actions) {
  const el = document.createElement('div')
  const list = document.createElement('div')
  el.appendChild(list)
  return {
    el,
    setItems(items) {
      list.replaceChildren()
      if (!items.length) {
        const e = document.createElement('div')
        e.className = 'ui-empty'
        e.textContent = '线路库为空 — 在规划面板保存第一条线路'
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
    update(stats, pts, weatherDays) {
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
      // trip-day band (itinerary axis, NOT spatial): one column per trip day
      if (hasBand) {
        const colW = (W - 20) / weatherDays.length
        weatherDays.forEach((d, i) => {
          ctx.fillStyle = d.isRain ? 'rgba(74,144,217,0.55)' : 'rgba(240,234,214,0.7)'
          ctx.fillRect(10 + i * colW, bandTop, Math.max(colW - 1, 1), BAND_H)
          if (weatherDays.length <= 8 || i === 0 || i === weatherDays.length - 1) {
            ctx.fillStyle = '#17191b'
            ctx.font = '8px monospace'
            ctx.textAlign = 'center'
            ctx.fillText(d.date.slice(5), 10 + i * colW + colW / 2, bandTop + 9)
          }
        })
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
      ctx.fillStyle = '#17191b'
      ctx.font = '10px monospace'
      ctx.fillText(`${Math.round(min)} m`, 10, H - 4)
      ctx.fillText(`${Math.round(max)} m`, 10, profileTop + 10)
    },
  }
}
