// Bottom elevation-profile panel + route stats line + library list. DOM/canvas, no three.
export class RouteHud {
  constructor(accent = '#ff4d00') {
    this.accent = accent
    this.el = document.createElement('div')
    this.el.className = 'route-hud'
    this.el.innerHTML = `
      <div class="route-stats">打点开始规划线路</div>
      <canvas class="route-profile" width="560" height="120"></canvas>
      <div class="route-library"><select><option value="">线路库…</option></select>
        <button data-act="load">加载</button><button data-act="del">删除</button></div>`
    this.el.querySelector('[data-act=load]').onclick = () => this.onLoad?.(this.el.querySelector('select').value)
    this.el.querySelector('[data-act=del]').onclick = () => this.onDelete?.(this.el.querySelector('select').value)
    document.body.appendChild(this.el)
    this.canvas = this.el.querySelector('canvas')
    this.statsEl = this.el.querySelector('.route-stats')
    this.select = this.el.querySelector('select')
  }

  setStats(route, stats) {
    if (!stats || !route.waypoints.length) {
      this.statsEl.textContent = route.waypoints.length ? `${route.name} · ${route.waypoints.length} 点` : '打点开始规划线路'
      this._draw([])
      return
    }
    const km = (stats.distanceM / 1000).toFixed(1)
    this.statsEl.textContent =
      `${route.name} · ${route.waypoints.length} 点 · ${km} km · ↑${stats.ascentM}m ↓${stats.descentM}m` +
      ` · 最高 ${stats.maxEle}m · 示意车程 ${Math.floor(stats.driveMinutes / 60)}h${stats.driveMinutes % 60}m`
  }

  drawProfile(pts) { this._draw(pts) }

  _draw(pts) {
    const ctx = this.canvas.getContext('2d')
    const { width: W, height: H } = this.canvas
    ctx.clearRect(0, 0, W, H)
    if (!pts.length) return
    const eles = pts.map((p) => p.ele)
    const min = Math.min(...eles), max = Math.max(...eles), span = Math.max(max - min, 1)
    ctx.strokeStyle = this.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    pts.forEach((p, i) => {
      const x = (i / (pts.length - 1)) * (W - 20) + 10
      const y = H - 18 - ((p.ele - min) / span) * (H - 40)
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.stroke()
    ctx.fillStyle = '#17191b'
    ctx.font = '12px monospace'
    ctx.fillText(`${Math.round(max)} m`, 10, 14)
    ctx.fillText(`${Math.round(min)} m`, 10, H - 6)
  }

  setLibrary(items) {
    // DOM API, not innerHTML — route names are user/GPX-controlled (XSS)
    this.select.replaceChildren()
    const head = document.createElement('option')
    head.value = ''
    head.textContent = '线路库…'
    this.select.appendChild(head)
    for (const i of items) {
      const o = document.createElement('option')
      o.value = i.id
      o.textContent = `${i.name} (${i.waypointCount}点)`
      this.select.appendChild(o)
    }
  }
}
