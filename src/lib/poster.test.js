import { describe, it, expect } from 'vitest'
import { buildPosterData, layoutPoster, fitCrop } from './poster.js'

const route = {
  name: '乌兰哈达火山环线',
  waypoints: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  dayEnds: ['x'],
}
const stats = { distanceM: 1301400, ascentM: 2583, descentM: 2554, maxEle: 1685, driveMinutes: 1193 }
const legs = [
  { from: 'A', to: 'B', distanceM: 416900, durationS: 17160, real: true },
  { from: 'B', to: 'C', distanceM: 400000, durationS: 14400, real: true },
]
const wx = { index: { overall: 62 }, agg: [{ isRain: false }, { isRain: true }, { isRain: false }] }

describe('buildPosterData', () => {
  it('assembles title, stats row, days, weather', () => {
    const d = buildPosterData({ route, stats, legs, weather: wx, profile: 'car' })
    expect(d.title).toBe('乌兰哈达火山环线')
    expect(d.durationText).toMatch(/8h46m/) // 17160s + 14400s = 526min
    expect(d.profileLabel).toContain('驾车')
    expect(d.distanceText).toBe('1301.4 km')
    expect(d.eleText).toContain('↑2583m')
    expect(d.eleText).toContain('↓2554m')
    expect(d.maxEleText).toContain('1685m')
    expect(d.waypointText).toBe('3 点 · 2 天')
    expect(d.weatherIndexText).toBe('62')
    expect(d.weatherDays).toEqual([false, true, false])
  })
  it('falls back gracefully without weather/legs', () => {
    const d = buildPosterData({ route, stats, legs: null, weather: null, profile: 'foot' })
    expect(d.weatherIndexText).toBeNull()
    expect(d.weatherDays).toBeNull()
    expect(d.profileLabel).toBe('示意') // no real legs → heuristic label, no fake precision
    expect(d.durationText).toBeTruthy()
  })
  it('long titles are truncated with ellipsis', () => {
    const d = buildPosterData({ route: { ...route, name: '这是一个非常非常非常长的线路名字超过了海报标题允许的最大长度限制' }, stats, legs, weather: null, profile: 'foot' })
    expect(d.title.length).toBeLessThanOrEqual(21)
    expect(d.title.endsWith('…')).toBe(true)
  })
})

describe('layoutPoster', () => {
  it('1080×1350 layout: blocks fit within canvas, no overlaps', () => {
    const l = layoutPoster(1080, 1350)
    for (const key of ['header', 'stats', 'band', 'qr', 'credit']) {
      expect(l[key].y).toBeGreaterThanOrEqual(0)
      expect(l[key].y + l[key].h).toBeLessThanOrEqual(1350)
    }
    expect(l.qr.size).toBeGreaterThanOrEqual(96)
  })
})

describe('fitCrop', () => {
  it('cover-crops source into target aspect', () => {
    const c = fitCrop(1920, 1080, 1080, 1350) // wide source → crop sides
    expect(c.sh).toBe(1080)
    expect(c.sw).toBeLessThan(1920)
    const c2 = fitCrop(800, 1600, 1080, 1350) // tall source → crop top/bottom
    expect(c2.sw).toBe(800)
    expect(c2.sh).toBeLessThan(1600)
  })
})
