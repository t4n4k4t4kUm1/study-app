import { describe, expect, it } from 'vitest'
import { formatDuration, percent } from './studySession'

describe('formatDuration', () => {
  it.each([
    [0, '0秒'],
    [42_400, '42秒'],
    [59_600, '1分00秒'], // 四捨五入で60秒になったら「1分」
    [65_000, '1分05秒'],
    [3_725_000, '62分05秒'],
    [-5, '0秒'],
  ])('%i ミリ秒は「%s」', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })
})

describe('percent', () => {
  it('正答率を整数の % にする。0問なら 0', () => {
    expect(percent(3, 4)).toBe(75)
    expect(percent(0, 0)).toBe(0)
  })
})
