import { describe, it, expect } from 'vitest'
import { slopeColorOf, tickIntervalM, ARROW_SPACING_M } from './slopeStyle.js'

describe('slopeColorOf', () => {
  it('bands: <5 green, 5-15 yellow, 15-25 orange, >25 red', () => {
    expect(slopeColorOf(0)).toEqual([0.30, 0.69, 0.31])
    expect(slopeColorOf(4.99)).toEqual([0.30, 0.69, 0.31])
    expect(slopeColorOf(5)).toEqual([0.97, 0.82, 0.33])
    expect(slopeColorOf(14.9)).toEqual([0.97, 0.82, 0.33])
    expect(slopeColorOf(15)).toEqual([1, 0.30, 0])
    expect(slopeColorOf(24.9)).toEqual([1, 0.30, 0])
    expect(slopeColorOf(25)).toEqual([0.83, 0.18, 0.18])
    expect(slopeColorOf(45)).toEqual([0.83, 0.18, 0.18])
  })
  it('handles negative (downhill) by absolute value', () => {
    expect(slopeColorOf(-6)).toEqual([0.97, 0.82, 0.33])
    expect(slopeColorOf(-30)).toEqual([0.83, 0.18, 0.18])
  })
  it('non-finite falls back to green', () => {
    expect(slopeColorOf(NaN)).toEqual([0.30, 0.69, 0.31])
    expect(slopeColorOf(Infinity)).toEqual([0.30, 0.69, 0.31])
  })
})

describe('tickIntervalM', () => {
  it('<8km → 1km; 8-40km → 5km; >40km → 10km', () => {
    expect(tickIntervalM(4900)).toBe(1000)
    expect(tickIntervalM(8000)).toBe(5000)
    expect(tickIntervalM(40000)).toBe(5000)
    expect(tickIntervalM(40001)).toBe(10000)
  })
})

describe('ARROW_SPACING_M', () => {
  it('is a positive finite constant', () => {
    expect(ARROW_SPACING_M).toBeGreaterThan(0)
    expect(Number.isFinite(ARROW_SPACING_M)).toBe(true)
  })
})
