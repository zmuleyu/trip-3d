// Context panel contents + profile floating card. DOM only; fed by main.js.

// ---------------------------------------------------------------- planning panel
export function createPlanningPanel(actions) {
  const el = document.createElement('div')

  const name = document.createElement('input')
  name.className = 'name-input'
  name.value = '未命名线路'
  name.onchange = () => actions.onNameChange(name.value)
  el.appendChild(name)

  const wpList = document.createElement('div')
  wpList.className = 'ui-wp-list'
  el.appendChild(wpList)

  const stat = document.createElement('div')
  stat.className = 'ui-stat-card'
  el.appendChild(stat)

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
  mk('导出GPX', actions.onExportGpx)
  mk('导入GPX', actions.onImportGpx)
  el.appendChild(row)

  return {
    el,
    get nameEl() { return name },
    update(route, stats) {
      if (document.activeElement !== name) name.value = route.name
      wpList.replaceChildren()
      route.waypoints.forEach((w, i) => {
        const item = document.createElement('div')
        item.className = 'ui-wp-item'
        const coord = `${w.lon.toFixed(4)}, ${w.lat.toFixed(4)} · ${Math.round(w.ele)}m`
        item.innerHTML = `<span class="n">${i + 1}</span><span></span>`
        item.children[1].textContent = w.name
        const c = document.createElement('span')
        c.className = 'coord'
        c.textContent = coord
        item.appendChild(c)
        wpList.appendChild(item)
      })
      if (!route.waypoints.length) {
        stat.innerHTML = '<span class="disclaimer">点击地形落第一个途经点</span>'
        return
      }
      const km = stats && stats.distanceM ? (stats.distanceM / 1000).toFixed(1) : '0.0'
      stat.replaceChildren()
      const line1 = document.createElement('div')
      const b = document.createElement('b')
      b.textContent = `${km} km`
      line1.appendChild(b)
      line1.append(` · ${route.waypoints.length} 点`)
      if (stats) line1.append(` · ↑${stats.ascentM}m ↓${stats.descentM}m`)
      const line2 = document.createElement('div')
      if (stats) {
        line2.textContent = `最高 ${stats.maxEle}m · 示意车程 ${Math.floor(stats.driveMinutes / 60)}h${stats.driveMinutes % 60}m `
        const d = document.createElement('span')
        d.className = 'disclaimer'
        d.textContent = '(启发式,非导航)'
        line2.appendChild(d)
      }
      stat.append(line1, line2)
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
  head.onclick = () => {
    folded = !folded
    el.classList.toggle('folded', folded)
    fold.textContent = folded ? '展开 ▸' : '收起 ▾'
  }
  return {
    el,
    update(stats, pts) {
      if (!pts || pts.length < 2) {
        el.classList.add('hidden')
        return
      }
      el.classList.remove('hidden')
      title.textContent = `高程剖面 · ${(stats.distanceM / 1000).toFixed(1)} km · 最高 ${stats.maxEle}m`
      const ctx = canvas.getContext('2d')
      const { width: W, height: H } = canvas
      ctx.clearRect(0, 0, W, H)
      const eles = pts.map((p) => p.ele)
      const min = Math.min(...eles), max = Math.max(...eles), span = Math.max(max - min, 1)
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = (i / (pts.length - 1)) * (W - 20) + 10
        const y = H - 16 - ((p.ele - min) / span) * (H - 36)
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      })
      ctx.stroke()
      ctx.fillStyle = '#17191b'
      ctx.font = '10px monospace'
      ctx.fillText(`${Math.round(min)} m`, 10, H - 4)
      ctx.fillText(`${Math.round(max)} m`, 10, 10)
    },
  }
}
