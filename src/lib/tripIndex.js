// Trip weather index: 0–100 score per day (worst representative point), aggregated.
// Pure module. Penalties per converged design:
// precip 8/mm cap 60 · wind>30km/h 1.5/km/h cap 20 · tempMin<0 −10 · thunder(95-99) −15
export function dailyIndex(day) {
  let s = 100
  s -= Math.min(60, (day.precipMm ?? 0) * 8)
  s -= Math.min(20, Math.max(0, (day.windMax ?? 0) - 30) * 1.5)
  if ((day.tempMin ?? 99) < 0) s -= 10
  if (day.weatherCode >= 95 && day.weatherCode <= 99) s -= 15
  return Math.max(0, Math.min(100, Math.round(s)))
}

// days: WeatherDay[] across representative points.
// perDay: worst point score per date; overall: mean of perDay, biased to worst day.
export function tripIndex(days) {
  if (!days.length) return null
  const byDate = new Map()
  for (const d of days) {
    const score = dailyIndex(d)
    const cur = byDate.get(d.date)
    if (!cur || score < cur.score) byDate.set(d.date, { date: d.date, score, worstPoint: d.point })
  }
  const perDay = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const min = Math.min(...perDay.map((d) => d.score))
  const avg = perDay.reduce((s, d) => s + d.score, 0) / perDay.length
  const overall = Math.round(avg * 0.5 + min * 0.5) // 均分与最差日各占一半权重
  return { overall, perDay, worst: perDay.find((d) => d.score === min) }
}

export function indexLabel(score) {
  if (score >= 85) return '极佳'
  if (score >= 65) return '适宜'
  if (score >= 45) return '一般'
  if (score >= 25) return '较差'
  return '不宜'
}
