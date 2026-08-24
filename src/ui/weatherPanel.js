// Weather panel: date/days inputs, explicit query, per-point cards, trip index.
// DOM only; main.js wires data flow. Panel state (date/days) persists to localStorage.
import { tripDates, MAX_TRIP_DAYS } from '../lib/weather.js'
import { indexLabel } from '../lib/tripIndex.js'

const LS_KEY = 'trip3d.weatherPanel'
const weatherLabel = (code) => code === 0 ? '晴' : code <= 3 ? '多云' : code <= 48 ? '雾' : code <= 67 ? '雨' : code <= 77 ? '雪' : code <= 86 ? '阵雨雪' : '雷暴'

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const plusDays = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)

export function createWeatherPanel({ onQuery, onPointFocus }) {
  const el = document.createElement('div')
  const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  const today = todayLocal()
  const maxStart = plusDays(today, MAX_TRIP_DAYS - 1)
  const minStart = plusDays(today, -395) // archive: up to ~last year + a margin
  const maxFar = plusDays(today, 395) // far-future dates also go to the archive window

  el.innerHTML = `
    <div class="wx-controls">
      <label>出发日期 <input type="date" class="wx-date" min="${minStart}" max="${maxFar}" value="${saved.start ?? today}"></label>
      <label>天数 <input type="number" class="wx-days" min="1" max="${MAX_TRIP_DAYS}" value="${saved.days ?? 3}"></label>
      <label class="wx-allpts"><input type="checkbox" class="wx-allpts-cb"${saved.allPoints ? ' checked' : ''}> 全部途经点</label>
      <button class="wx-go primary">查询天气</button>
    </div>
    <div class="wx-index hidden"></div>
    <div class="wx-status">选择日期后查询 — ≤16 天为预报;超窗自动回填去年历史同期(ERA5)</div>
    <div class="wx-points hidden" aria-label="路线天气地点"></div>
    <section class="wx-hourly hidden" aria-labelledby="wx-hourly-title">
      <header><h3 id="wx-hourly-title">逐小时预报</h3><button type="button" aria-label="关闭逐小时预报">×</button></header>
      <p class="wx-hourly-note"></p>
      <div class="wx-hourly-list"></div>
    </section>
    <div class="wx-cards"></div>
    <div class="wx-attr">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a>(非商用,CC-BY 4.0)</div>`

  const dateEl = el.querySelector('.wx-date')
  const daysEl = el.querySelector('.wx-days')
  const goBtn = el.querySelector('.wx-go')
  const allPtsEl = el.querySelector('.wx-allpts-cb')
  const statusEl = el.querySelector('.wx-status')
  const cardsEl = el.querySelector('.wx-cards')
  const pointsEl = el.querySelector('.wx-points')
  const indexEl = el.querySelector('.wx-index')
  const hourlyEl = el.querySelector('.wx-hourly')
  const hourlyTitle = hourlyEl.querySelector('h3')
  const hourlyNote = hourlyEl.querySelector('.wx-hourly-note')
  const hourlyList = hourlyEl.querySelector('.wx-hourly-list')
  const hideHourly = () => hourlyEl.classList.add('hidden')
  hourlyEl.querySelector('button').onclick = hideHourly

  const persist = () => localStorage.setItem(LS_KEY, JSON.stringify({ start: dateEl.value, days: +daysEl.value, allPoints: allPtsEl.checked }))
  dateEl.onchange = persist
  daysEl.onchange = persist
  allPtsEl.onchange = persist

  goBtn.onclick = () => {
    const start = dateEl.value
    const days = Math.min(Math.max(1, +daysEl.value || 1), MAX_TRIP_DAYS)
    if (!start || start < minStart || start > maxFar) {
      setStatus(`出发日期须在 ${minStart} ~ ${maxFar} 之间(超窗自动用历史同期)`, 'error')
      return
    }
    const dates = tripDates(start, days)
    onQuery({ start, days, dates, allPoints: allPtsEl.checked })
  }

  function setStatus(text, kind = 'info') {
    statusEl.textContent = text
    statusEl.dataset.kind = kind
  }

  return {
    el,
    setLoading(pts) {
      goBtn.disabled = true
      hideHourly()
      indexEl.classList.add('hidden')
      pointsEl.classList.add('hidden')
      cardsEl.replaceChildren()
      setStatus(`查询中: ${pts.map((p) => p.role).join(' / ')} …`)
    },
    setError(msg) {
      goBtn.disabled = false
      hideHourly()
      setStatus(msg, 'error')
    },
    setEmptyRoute() {
      goBtn.disabled = false
      hideHourly()
      indexEl.classList.add('hidden')
      pointsEl.classList.add('hidden')
      cardsEl.replaceChildren()
      setStatus('先在规划 tab 打点成线(至少 1 个途经点)', 'error')
    },
    // agg: aggregateTripDays result; rep: points queried; index: tripIndex result; repLabel: 代表点|途经点
    setResult({ agg, rep, index, repLabel = '代表点', source = 'forecast' }) {
      goBtn.disabled = false
      hideHourly()
      const srcNote = source === 'archive' ? '历史同期(去年 ERA5 参考)' : '数据为预报,出行前请复核'
      setStatus(`${agg[0].date} ~ ${agg.at(-1).date} · ${rep.length} 个${repLabel} · ${srcNote}`)
      if (index) {
        indexEl.classList.remove('hidden')
        indexEl.innerHTML = `出行指数 <b>${index.overall}</b> <span>${indexLabel(index.overall)}</span>` +
          `<em>最差日 ${index.worst.date}(${index.worst.score})</em>`
      }
      cardsEl.replaceChildren()
      pointsEl.replaceChildren()
      pointsEl.classList.toggle('hidden', !rep.length)
      for (const point of rep) {
        const weather = agg.flatMap((day) => day.points ?? []).find((entry) => entry.point.lon === point.lon && entry.point.lat === point.lat)
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'wx-point'
        const name = document.createElement('b')
        name.textContent = point.role ?? point.name ?? '天气点'
        const summary = document.createElement('span')
        summary.textContent = weather ? `${Math.round(weather.tempMin)}–${Math.round(weather.tempMax)}°C · ${weather.precipMm.toFixed(1)}mm` : '数据未知'
        button.append(name, summary)
        button.onfocus = () => onPointFocus?.(point.role ?? point.name ?? '', false)
        button.onclick = () => onPointFocus?.(point.role ?? point.name ?? '', true)
        pointsEl.appendChild(button)
      }
      for (const day of agg) {
        const card = document.createElement('div')
        card.className = 'wx-card' + (day.isRain ? ' rain' : '')
        const head = document.createElement('div')
        head.className = 'wx-card-head'
        head.innerHTML = `<span class="d">${day.date.slice(5)}</span><span class="ico">${weatherLabel(day.weatherCode)}</span>` +
          `<span class="t">${Math.round(day.tempMin)}~${Math.round(day.tempMax)}°C</span>` +
          `<span class="p">降水 ${day.precipMm.toFixed(1)}mm</span>` +
          `<span class="w">风 ${Math.round(day.windMax)}km/h</span>`
        card.appendChild(head)
        const sub = document.createElement('div')
        sub.className = 'wx-card-sub'
        sub.textContent = day.points.map((p) => {
          const rp = rep.find((r) => r.lon === p.point.lon && r.lat === p.point.lat)
          const role = rp?.role ?? p.point.name ?? ''
          return `${role} ${weatherLabel(p.weatherCode)} ${p.precipMm.toFixed(1)}mm`
        }).join(' · ')
        card.appendChild(sub)
        cardsEl.appendChild(card)
      }
    },
    showHourlyDetails({ point, date, hours = [], source = 'forecast' } = {}) {
      const role = point?.role ?? point?.name ?? '路线天气点'
      hourlyTitle.textContent = `${role} · 逐小时预报`
      hourlyNote.textContent = `${date || '所选日期'} · ${source === 'archive' ? '历史同期参考' : 'Open-Meteo 预报'}`
      hourlyList.replaceChildren()
      if (!hours.length) {
        const empty = document.createElement('p')
        empty.className = 'wx-hourly-empty'
        empty.textContent = '该日期暂无逐小时数据，请重新查询天气。'
        hourlyList.appendChild(empty)
      } else {
        for (const hour of hours) {
          const row = document.createElement('div')
          row.className = 'wx-hourly-row'
          const time = document.createElement('time')
          time.dateTime = hour.time ?? ''
          time.textContent = hour.time?.slice?.(11, 16) || hour.time || '—'
          const condition = document.createElement('span')
          condition.textContent = weatherLabel(hour.weatherCode)
          const temperature = document.createElement('b')
          temperature.textContent = Number.isFinite(hour.temperature) ? `${Math.round(hour.temperature)}°C` : '—'
          const precip = document.createElement('span')
          precip.textContent = Number.isFinite(hour.precipMm) ? `降水 ${hour.precipMm.toFixed(1)}mm` : '降水未知'
          const wind = document.createElement('span')
          wind.textContent = Number.isFinite(hour.windKmh) ? `风 ${Math.round(hour.windKmh)}km/h` : '风速未知'
          row.append(time, condition, temperature, precip, wind)
          hourlyList.appendChild(row)
        }
      }
      hourlyEl.classList.remove('hidden')
      hourlyEl.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    },
    // trip-day count sync (multi-day segmentation): keep the days input aligned
    // with the itinerary; user edits still win after the sync.
    setTripDays(n) {
      daysEl.value = String(Math.min(Math.max(1, n), MAX_TRIP_DAYS))
      persist()
    },
  }
}
