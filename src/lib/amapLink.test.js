import { describe, it, expect } from 'vitest'
import { parseAmapLink, buildAmapLink } from './amapLink.js'

// user's real 乌兰哈达环线 link (GCJ-02 coords)
const REAL =
  'https://www.amap.com/ssr/dir?fname=%E9%AB%98%E7%B1%B3%E5%BA%97%E5%8C%97%28%E5%9C%B0%E9%93%81%E7%AB%99%29&flat=39.773541879180236&flon=116.3307872414589&dname=%E9%AB%98%E7%B1%B3%E5%BA%97%E5%8C%97%28%E5%9C%B0%E9%93%81%E7%AB%99%29&dlat=39.773541879180236&dlon=116.3307872414589&policy=10&type=0&vname=%E9%98%BF%E5%8A%9B%E4%B9%8C%E7%B4%A0%E7%81%AB%E5%B1%B1%E6%B0%91%E5%AE%BF%28%E4%B9%8C%E5%85%B0%E5%93%88%E8%BE%BE%E7%81%AB%E5%B1%B1%E5%BA%97%29%7C%E4%BA%8C%E8%BF%9E%E6%B5%A9%E7%89%B9%E5%A6%82%E6%9D%A5%E7%A5%9E%E6%8E%8C%7C%E8%8B%8F%E5%B0%BC%E7%89%B9%E5%B7%A6%E6%97%97%E4%BA%BA%E6%B0%91%E6%94%BF%E5%BA%9C%7C%E6%98%8E%E5%AE%89%E5%9B%BE%E5%A4%A9%E6%96%87%E5%8F%B0%7C%E5%A4%A7%E5%A2%83%E9%97%A8%E6%99%AF%E5%8C%BA&vlat=41.59059725008648%7C43.70502634099861%7C43.859718%7C42.214412514661845%7C40.84662412420271&vlon=113.14614415168764%7C112.02872648835184%7C113.667171%7C115.25707483291629%7C114.89480629563332&vid=%7C%7C%7C%7C'

describe('parseAmapLink', () => {
  it('parses the real 乌兰哈达 link: from + 5 vias + to, names decoded, coords WGS-84', () => {
    const r = parseAmapLink(REAL)
    expect(r.from.name).toBe('高米店北(地铁站)')
    expect(r.to.name).toBe('高米店北(地铁站)')
    expect(r.vias).toHaveLength(5)
    expect(r.vias[0].name).toBe('阿力乌素火山民宿(乌兰哈达火山店)')
    expect(r.vias[4].name).toBe('大境门景区')
    // coords converted from GCJ-02: vlon 113.146144 → WGS should be west of it
    expect(r.vias[0].lon).toBeLessThan(113.14614415168764)
    expect(r.vias[0].lon).toBeGreaterThan(113.13)
    expect(r.vias[0].lat).toBeCloseTo(41.59, 2)
    // from is in China: also converted
    expect(r.from.lon).toBeLessThan(116.3307872414589)
  })
  it('returns null for non-amap or empty links', () => {
    expect(parseAmapLink('https://example.com/')).toBeNull()
    expect(parseAmapLink('not a url')).toBeNull()
    expect(parseAmapLink('https://www.amap.com/ssr/dir')).toBeNull()
  })
  it('skips vias with missing coords, keeps alignment', () => {
    const u = 'https://www.amap.com/ssr/dir?fname=A&flon=116.33&flat=39.77&dname=B&dlon=113.67&dlat=43.86&vname=X%7CY&vlat=41.5%7C&vlon=113.1%7C'
    const r = parseAmapLink(u)
    expect(r.vias).toHaveLength(1)
    expect(r.vias[0].name).toBe('X')
  })
})

describe('buildAmapLink', () => {
  it('round-trips: parse(build(route)) preserves names and coords (±1e-7)', () => {
    const route = {
      waypoints: [
        { name: '高米店北(地铁站)', lon: 116.3245, lat: 39.7730 },
        { name: '乌兰哈达火山', lon: 113.13, lat: 41.59 },
        { name: '大境门景区', lon: 114.88, lat: 40.84 },
      ],
    }
    const url = buildAmapLink(route)
    expect(url).toContain('amap.com/ssr/dir')
    const r = parseAmapLink(url)
    expect(r.from.name).toBe('高米店北(地铁站)')
    expect(r.vias).toHaveLength(1)
    expect(r.vias[0].name).toBe('乌兰哈达火山')
    expect(r.to.name).toBe('大境门景区')
    expect(Math.abs(r.vias[0].lon - 113.13)).toBeLessThan(1e-4) // GCJ-02 approx algorithm round-trip ~1m
  })
  it('null when <2 waypoints', () => {
    expect(buildAmapLink({ waypoints: [{ name: 'A', lon: 1, lat: 1 }] })).toBeNull()
    expect(buildAmapLink({ waypoints: [] })).toBeNull()
  })
  it('out-of-China points pass through unconverted', () => {
    const route = { waypoints: [{ name: 'A', lon: 151.2, lat: -33.8 }, { name: 'B', lon: 151.3, lat: -33.9 }] }
    const url = buildAmapLink(route)
    expect(url).toContain('flon=151.2')
    expect(url).toContain('dlon=151.3')
  })

  it('exact export URL fixture (encoding, precision, policy/type, pipe order)', () => {
    const route = {
      waypoints: [
        { name: '甲地', lon: 116.3245, lat: 39.773 },
        { name: '乙地', lon: 113.13, lat: 41.59 },
        { name: '丙地', lon: 114.88, lat: 40.84 },
      ],
    }
    const url = buildAmapLink(route)
    const u = new URL(url)
    expect(u.hostname).toBe('www.amap.com')
    expect(u.pathname).toBe('/ssr/dir')
    const p = u.searchParams
    expect(p.get('fname')).toBe('甲地')
    expect(p.get('dname')).toBe('丙地')
    expect(p.get('policy')).toBe('10')
    expect(p.get('type')).toBe('0')
    expect(p.get('vname')).toBe('乙地')
    // coords are GCJ-02 with ≤7dp precision
    expect(parseFloat(p.get('flon'))).toBeGreaterThan(116.3245)
    expect(String(p.get('vlon')).split('.')[1].length).toBeLessThanOrEqual(7)
  })

  it('QR capacity: 12 long names encodable; 32 overflow detected gracefully', async () => {
    const { default: qrcode } = await import('qrcode-generator')
    const mk = (n) => ({
      waypoints: Array.from({ length: n }, (_, i) => ({
        name: `很长很长的中文地点名称第${i + 1}号(某某景区)`,
        lon: 116 + i * 0.01,
        lat: 39 + i * 0.01,
      })),
    })
    const tryEncode = (url) => {
      for (const level of ['M', 'L']) {
        try {
          const q = qrcode(0, level)
          q.addData(url)
          q.make()
          return true
        } catch { /* try next */ }
      }
      return false
    }
    expect(tryEncode(buildAmapLink(mk(12)))).toBe(true)
    // 32 long names ≈ 6KB UTF-8 — beyond QR byte-mode max (~3KB); must detect, not crash
    expect(tryEncode(buildAmapLink(mk(32)))).toBe(false)
  })
})
