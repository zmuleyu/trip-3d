import { describe, it, expect } from 'vitest'
import { tripIndex, dailyIndex, indexLabel } from './tripIndex.js'

describe('dailyIndex', () => {
  it('perfect day scores 100', () => {
    expect(dailyIndex({ precipMm: 0, weatherCode: 0, windMax: 5, tempMin: 10 })).toBe(100)
  })
  it('precipitation dominates: 7.5mm+ caps precip penalty at 60', () => {
    expect(dailyIndex({ precipMm: 7.5, weatherCode: 0, windMax: 0, tempMin: 10 })).toBe(40)
    expect(dailyIndex({ precipMm: 20, weatherCode: 0, windMax: 0, tempMin: 10 })).toBe(40)
  })
  it('wind penalty starts above 30 km/h, capped at 20', () => {
    expect(dailyIndex({ precipMm: 0, weatherCode: 0, windMax: 30, tempMin: 10 })).toBe(100)
    expect(dailyIndex({ precipMm: 0, weatherCode: 0, windMax: 40, tempMin: 10 })).toBe(85)
    expect(dailyIndex({ precipMm: 0, weatherCode: 0, windMax: 100, tempMin: 10 })).toBe(80)
  })
  it('freezing tempMin and thunderstorm subtract', () => {
    expect(dailyIndex({ precipMm: 0, weatherCode: 0, windMax: 0, tempMin: -1 })).toBe(90)
    expect(dailyIndex({ precipMm: 0, weatherCode: 95, windMax: 0, tempMin: 10 })).toBe(85)
  })
  it('clamps at 0 for catastrophic days', () => {
    expect(dailyIndex({ precipMm: 50, weatherCode: 99, windMax: 120, tempMin: -20 })).toBe(0)
  })
})

describe('tripIndex', () => {
  it('aggregates per-day indices across representative points: min day × avg', () => {
    const days = [
      { date: '2026-09-14', point: { name: 'P1' }, precipMm: 0, weatherCode: 0, windMax: 5, tempMin: 10 },
      { date: '2026-09-14', point: { name: 'P2' }, precipMm: 2, weatherCode: 61, windMax: 10, tempMin: 8 },
      { date: '2026-09-15', point: { name: 'P1' }, precipMm: 0, weatherCode: 1, windMax: 5, tempMin: 10 },
      { date: '2026-09-15', point: { name: 'P2' }, precipMm: 0, weatherCode: 1, windMax: 5, tempMin: 10 },
    ]
    const r = tripIndex(days)
    // day1: worst = P2 → 100-16=84; day2: 100 → overall = avg(92)*0.5 + min(84)*0.5 = 88
    expect(r.overall).toBe(88)
    expect(r.worst.date).toBe('2026-09-14')
    expect(r.worst.score).toBe(84)
    expect(r.perDay).toHaveLength(2)
  })
  it('empty days → null', () => {
    expect(tripIndex([])).toBeNull()
  })
})

describe('indexLabel', () => {
  it('bands scores', () => {
    expect(indexLabel(90)).toBe('极佳')
    expect(indexLabel(70)).toBe('适宜')
    expect(indexLabel(50)).toBe('一般')
    expect(indexLabel(30)).toBe('较差')
    expect(indexLabel(10)).toBe('不宜')
  })
})
