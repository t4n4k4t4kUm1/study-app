import { describe, expect, it } from 'vitest'
import { studyIds, weakCardIds, weakCounts, type CardResult } from './weak'

// r('a', false, 1)：カード a を、1日目に、ふつうの向きで間違えた
const r = (
  cardId: string,
  correct: boolean,
  day: number,
  direction: CardResult['direction'] = 'forward',
): CardResult => ({
  cardId,
  direction,
  correct,
  answeredAt: `2026-11-0${day}T10:00:00.000Z`,
})

describe('weakCardIds（苦手なカードを選ぶ）', () => {
  it('最後の答えが間違いのカードだけが苦手', () => {
    const results = [r('a', false, 1), r('b', true, 1), r('c', false, 1)]
    expect(weakCardIds(['a', 'b', 'c'], results, 'forward')).toEqual(['a', 'c'])
  })

  it('間違えたあとに正解したら、苦手から外れる（付箋をはがす）', () => {
    expect(weakCardIds(['a'], [r('a', false, 1), r('a', true, 2)], 'forward')).toEqual([])
  })

  it('正解したあとに間違えたら、また苦手になる', () => {
    expect(weakCardIds(['a'], [r('a', true, 1), r('a', false, 2)], 'forward')).toEqual(['a'])
  })

  it('記録が古い順に並んでいなくても、時刻で最後の答えを決める', () => {
    expect(weakCardIds(['a'], [r('a', true, 3), r('a', false, 1)], 'forward')).toEqual([])
  })

  it('一度も答えていないカードは苦手に入れない', () => {
    expect(weakCardIds(['a', 'b'], [r('a', false, 1)], 'forward')).toEqual(['a'])
  })

  it('ふつうの向きと逆向きは分けて考える', () => {
    const results = [r('a', false, 1, 'reverse'), r('b', false, 1, 'forward'), r('b', true, 2, 'reverse')]
    expect(weakCardIds(['a', 'b'], results, 'forward')).toEqual(['b'])
    expect(weakCardIds(['a', 'b'], results, 'reverse')).toEqual(['a'])
  })

  it('セットの並び順で返し、もうセットにないカードの記録は無視する', () => {
    const results = [r('c', false, 1), r('gone', false, 1), r('a', false, 1)]
    expect(weakCardIds(['a', 'b', 'c'], results, 'forward')).toEqual(['a', 'c'])
  })
})

describe('weakCounts（向きごとの枚数）', () => {
  it('向きごとに数える', () => {
    const results = [r('a', false, 1), r('b', false, 1), r('a', false, 1, 'reverse')]
    expect(weakCounts(['a', 'b'], results)).toEqual({ forward: 2, reverse: 1 })
  })
})

describe('studyIds（出題するカード）', () => {
  it('苦手だけでなければ全部、苦手だけならセットにある苦手のカードを、セットの並び順で', () => {
    expect(studyIds(['a', 'b', 'c'], null)).toEqual(['a', 'b', 'c'])
    expect(studyIds(['a', 'b', 'c'], ['c', 'a', 'gone'])).toEqual(['a', 'c'])
  })
})
