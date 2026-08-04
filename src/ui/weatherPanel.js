// Weather panel: date/days inputs, explicit query, per-point cards, trip index.
// DOM only; main.js wires data flow. Panel state (date/days) persists to localStorage.
import { tripDates, wmoIcon, MAX_TRIP_DAYS } from '../lib/weather.js'
import { indexLabel } from '../lib/tripIndex.js'

const LS_KEY = 'trip3d.weatherPanel'

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const plusDays = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)

export function createWeatherPanel({ onQuery }) {
  const el = document.createElement('div')
  const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  const today = todayLocal()
  const maxStart = plusDays(today, MAX_TRIP_DAYS - 1)

  el.innerHTML = `
    <div class="wx-controls">
      <label>出发日期 <input type="date" class="wx-date" min="${today}" max="${maxStart}" value="${saved.start ?? today}"></label>
      <label>天数 <input type="number" class="wx-days" min="1" max="${MAX_TRIP_DAYS}" value="${saved.days ?? 3}"></label>
      <button class="wx-go primary">查询天气</button>
    </div>
    <div class="wx-index hidden"></div>
    <div class="wx-status">选择日期后查询 — 取线路首/末/最高点天气(≤16 天预报窗口)</div>
    <div class="wx-cards"></div>
    <div class="wx-attr">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a>(非商用,CC-BY 4.0)</div>`

  const dateEl = el.querySelector('.wx-date')
  const daysEl = el.querySelector('.wx-days')
  const goBtn = el.querySelector('.wx-go')
  const statusEl = el.querySelector('.wx-status')
  const cardsEl = el.querySelector('.wx-cards')
  const indexEl = el.querySelector('.wx-index')

  const persist = () => localStorage.setItem(LS_KEY, JSON.stringify({ start: dateEl.value, days: +daysEl.value }))
  dateEl.onchange = persist
  daysEl.onchange = persist

  goBtn.onclick = () => {
    const start = dateEl.value
    const days = Math.min(Math.max(1, +daysEl.value || 1), MAX_TRIP_DAYS)
    if (!start || start < today || start > maxStart) {
      setStatus(`出发日期须在预报窗口内(${today} ~ ${maxStart})`, 'error')
      return
    }
    const dates = tripDates(start, days)
    onQuery({ start, days, dates })
  }

  function setStatus(text, kind = 'info') {
    statusEl.textContent = text
    statusEl.dataset.kind = kind
  }

  return {
    el,
    setLoading(pts) {
      goBtn.disabled = true
      indexEl.classList.add('hidden')
      cardsEl.replaceChildren()
      setStatus(`查询中: ${pts.map((p) => p.role).join(' / ')} …`)
    },
    setError(msg) {
      goBtn.disabled = false
      setStatus(msg, 'error')
    },
    setEmptyRoute() {
      goBtn.disabled = false
      indexEl.classList.add('hidden')
      cardsEl.replaceChildren()
      setStatus('先在规划 tab 打点成线(至少 1 个途经点)', 'error')
    },
    // agg: aggregateTripDays result; rep: representative points; index: tripIndex result
    setResult({ agg, rep, index }) {
      goBtn.disabled = false
      setStatus(`${agg[0].date} ~ ${agg.at(-1).date} · ${rep.length} 个代表点 · 数据为预报,出行前请复核`)
      if (index) {
        indexEl.classList.remove('hidden')
        indexEl.innerHTML = `出行指数 <b>${index.overall}</b> <span>${indexLabel(index.overall)}</span>` +
          `<em>最差日 ${index.worst.date}(${index.worst.score})</em>`
      }
      cardsEl.replaceChildren()
      for (const day of agg) {
        const card = document.createElement('div')
        card.className = 'wx-card' + (day.isRain ? ' rain' : '')
        const head = document.createElement('div')
        head.className = 'wx-card-head'
        head.innerHTML = `<span class="d">${day.date.slice(5)}</span><span class="ico">${wmoIcon(day.weatherCode)}</span>` +
          `<span class="t">${Math.round(day.tempMin)}~${Math.round(day.tempMax)}°C</span>` +
          `<span class="p">${day.isRain ? '🌧' : ''}${day.precipMm.toFixed(1)}mm</span>` +
          `<span class="w">风 ${Math.round(day.windMax)}km/h</span>`
        card.appendChild(head)
        const sub = document.createElement('div')
        sub.className = 'wx-card-sub'
        sub.textContent = day.points.map((p) => {
          const rp = rep.find((r) => r.lon === p.point.lon && r.lat === p.point.lat)
          const role = rp?.role ?? p.point.name ?? ''
          return `${role} ${wmoIcon(p.weatherCode)}${p.precipMm.toFixed(1)}`
        }).join(' · ')
        card.appendChild(sub)
        cardsEl.appendChild(card)
      }
    },
  }
}
