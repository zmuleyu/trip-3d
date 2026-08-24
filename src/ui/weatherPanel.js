// Along-route weather inspector. It only reads the current route; main.js owns
// the query, provider choice, stale-result protection, and route revision.
import { tripDates, MAX_TRIP_DAYS } from '../lib/weather.js'
import { indexLabel } from '../lib/tripIndex.js'

const LS_KEY = 'trip3d.weatherPanel'
const weatherLabel = (code) => code === 0 ? '晴' : code <= 3 ? '多云' : code <= 48 ? '雾' : code <= 67 ? '雨' : code <= 77 ? '雪' : code <= 86 ? '阵雨雪' : '雷暴'
const isoAt = (offset = 0) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function createWeatherPanel({ onQuery, onPointFocus, onRecoverRoute } = {}) {
  const el = document.createElement('div')
  el.className = 'wx-panel'
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { /* optional preference */ }
  const today = isoAt()
  const tomorrow = isoAt(1)
  const minStart = isoAt(-395)
  const maxFar = isoAt(395)
  const selected = typeof saved.date === 'string' ? saved.date : today
  el.innerHTML = `
    <button type="button" class="wx-route-context" aria-label="当前路线语境"></button>
    <section class="wx-date-section" aria-labelledby="wx-date-heading">
      <h3 id="wx-date-heading">选择日期</h3>
      <div class="wx-date-shortcuts" role="group" aria-label="日期快捷选择">
        <button type="button" data-date-choice="today">今天</button>
        <button type="button" data-date-choice="tomorrow">明天</button>
        <button type="button" data-date-choice="custom">自定义</button>
      </div>
      <label class="wx-date-input"><span>日期</span><input type="date" class="wx-date" min="${minStart}" max="${maxFar}" value="${selected}"></label>
    </section>
    <div class="wx-preflight" role="status"></div>
    <button type="button" class="wx-go primary">加载沿途天气</button>
    <div class="wx-status">预报窗口约 16 天；超出后使用去年 ERA5 历史同期参考</div>
    <div class="wx-index hidden"></div>
    <div class="wx-points hidden" aria-label="路线天气地点"></div>
    <section class="wx-hourly hidden" aria-labelledby="wx-hourly-title">
      <header><h3 id="wx-hourly-title">逐小时预报</h3><button type="button" aria-label="关闭逐小时预报">×</button></header>
      <p class="wx-hourly-note"></p><div class="wx-hourly-list"></div>
    </section>
    <div class="wx-cards"></div>
    <div class="wx-attr">天气数据：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>（非商用，CC-BY 4.0）</div>`

  const dateEl = el.querySelector('.wx-date')
  const goBtn = el.querySelector('.wx-go')
  const contextEl = el.querySelector('.wx-route-context')
  const preflightEl = el.querySelector('.wx-preflight')
  const statusEl = el.querySelector('.wx-status')
  const cardsEl = el.querySelector('.wx-cards')
  const pointsEl = el.querySelector('.wx-points')
  const indexEl = el.querySelector('.wx-index')
  const hourlyEl = el.querySelector('.wx-hourly')
  const hourlyTitle = hourlyEl.querySelector('h3')
  const hourlyNote = hourlyEl.querySelector('.wx-hourly-note')
  const hourlyList = hourlyEl.querySelector('.wx-hourly-list')
  let routeReady = false
  let routePointCount = 0
  const hideHourly = () => hourlyEl.classList.add('hidden')
  const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify({ date: dateEl.value })) } catch { /* optional preference */ } }
  const setStatus = (text, kind = 'info') => { statusEl.textContent = text; statusEl.dataset.kind = kind }
  const setChoice = (choice) => {
    if (choice === 'today') { dateEl.value = today; persist() }
    if (choice === 'tomorrow') { dateEl.value = tomorrow; persist() }
    if (choice === 'custom') dateEl.showPicker?.()
    for (const button of el.querySelectorAll('[data-date-choice]')) {
      const active = button.dataset.dateChoice === choice
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    }
  }
  el.querySelectorAll('[data-date-choice]').forEach((button) => { button.onclick = () => setChoice(button.dataset.dateChoice) })
  setChoice(dateEl.value === tomorrow ? 'tomorrow' : 'today')
  dateEl.onchange = () => { persist(); setChoice('custom') }
  contextEl.onclick = () => { if (!routeReady) onRecoverRoute?.() }
  hourlyEl.querySelector('button').onclick = hideHourly
  goBtn.onclick = () => {
    const date = dateEl.value
    if (!routeReady) { onRecoverRoute?.(); return }
    if (!date || date < minStart || date > maxFar) { setStatus(`日期须在 ${minStart} 至 ${maxFar} 之间`, 'error'); return }
    onQuery?.({ dates: tripDates(date, 1) })
  }

  return {
    el,
    setRouteContext({ route, distanceM } = {}) {
      const points = route?.waypoints ?? []
      routePointCount = points.length
      routeReady = points.length >= 2
      goBtn.disabled = !routeReady
      contextEl.classList.toggle('is-empty', !routeReady)
      if (!routeReady) {
        contextEl.innerHTML = '<b>尚未形成路线</b><span>回到规划，设置起点和终点</span>'
        preflightEl.textContent = '路线准备好后，将自动选择沿途代表点查询。'
        return
      }
      const km = Number.isFinite(distanceM) ? `${(distanceM / 1000).toFixed(1)} km` : '距离计算中'
      contextEl.innerHTML = `<b>${points[0].name || '起点'} → ${points.at(-1).name || '终点'}</b><span>${km} · ${points.length} 点</span>`
      preflightEl.textContent = `将按当前路线查询 ${Math.min(3, routePointCount)} 个沿途代表点`
    },
    setLoading(pts) {
      goBtn.disabled = true; hideHourly(); indexEl.classList.add('hidden'); pointsEl.classList.add('hidden'); cardsEl.replaceChildren()
      setStatus(`正在查询 ${pts.length} 个沿途代表点…`)
    },
    setError(msg) { goBtn.disabled = !routeReady; hideHourly(); setStatus(msg, 'error') },
    setEmptyRoute() { this.setRouteContext({ route: { waypoints: [] } }); setStatus('请先设置当前路线，再查询沿途天气。', 'error') },
    setResult({ agg, rep, index, source = 'forecast' }) {
      goBtn.disabled = false; hideHourly()
      const srcNote = source === 'archive' ? '历史同期（去年 ERA5 参考）' : '数据为预报，出行前请复核'
      setStatus(`${agg[0].date} · ${rep.length} 个沿途代表点 · ${srcNote}`)
      if (index) { indexEl.classList.remove('hidden'); indexEl.innerHTML = `出行指数 <b>${index.overall}</b> <span>${indexLabel(index.overall)}</span>` }
      cardsEl.replaceChildren(); pointsEl.replaceChildren(); pointsEl.classList.toggle('hidden', !rep.length)
      for (const point of rep) {
        const weather = agg.flatMap((day) => day.points ?? []).find((entry) => entry.point.lon === point.lon && entry.point.lat === point.lat)
        const button = document.createElement('button')
        button.type = 'button'; button.className = 'wx-point'
        button.innerHTML = `<b>${point.role ?? point.name ?? '路线天气点'}</b><span>${weather ? `${Math.round(weather.tempMin)}–${Math.round(weather.tempMax)}°C · ${weather.precipMm.toFixed(1)}mm` : '数据未知'}</span>`
        button.onfocus = () => onPointFocus?.(point.role ?? point.name ?? '', false)
        button.onclick = () => onPointFocus?.(point.role ?? point.name ?? '', true)
        pointsEl.appendChild(button)
      }
      for (const day of agg) {
        const card = document.createElement('div')
        card.className = 'wx-card' + (day.isRain ? ' rain' : '')
        card.innerHTML = `<div class="wx-card-head"><span class="d">${day.date.slice(5)}</span><span class="ico">${weatherLabel(day.weatherCode)}</span><span class="t">${Math.round(day.tempMin)}~${Math.round(day.tempMax)}°C</span><span class="p">降水 ${day.precipMm.toFixed(1)}mm</span><span class="w">风 ${Math.round(day.windMax)}km/h</span></div>`
        const sub = document.createElement('div')
        sub.className = 'wx-card-sub'
        sub.textContent = day.points.map((p) => `${rep.find((r) => r.lon === p.point.lon && r.lat === p.point.lat)?.role ?? p.point.name ?? ''} ${weatherLabel(p.weatherCode)} ${p.precipMm.toFixed(1)}mm`).join(' · ')
        card.appendChild(sub); cardsEl.appendChild(card)
      }
    },
    showHourlyDetails({ point, date, hours = [], source = 'forecast' } = {}) {
      const role = point?.role ?? point?.name ?? '路线天气点'
      hourlyTitle.textContent = `${role} · 逐小时预报`
      hourlyNote.textContent = `${date || '所选日期'} · ${source === 'archive' ? '历史同期参考' : 'Open-Meteo 预报'}`
      hourlyList.replaceChildren()
      if (!hours.length) {
        const empty = document.createElement('p'); empty.className = 'wx-hourly-empty'; empty.textContent = '该日期暂无逐小时数据，请重新查询天气。'; hourlyList.appendChild(empty)
      } else for (const hour of hours) {
        const row = document.createElement('div'); row.className = 'wx-hourly-row'
        row.innerHTML = `<time datetime="${hour.time ?? ''}">${hour.time?.slice?.(11, 16) || hour.time || '—'}</time><span>${weatherLabel(hour.weatherCode)}</span><b>${Number.isFinite(hour.temperature) ? `${Math.round(hour.temperature)}°C` : '—'}</b><span>${Number.isFinite(hour.precipMm) ? `降水 ${hour.precipMm.toFixed(1)}mm` : '降水未知'}</span><span>${Number.isFinite(hour.windKmh) ? `风 ${Math.round(hour.windKmh)}km/h` : '风速未知'}</span>`
        hourlyList.appendChild(row)
      }
      hourlyEl.classList.remove('hidden'); hourlyEl.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    },
    setTripDays() {},
  }
}
