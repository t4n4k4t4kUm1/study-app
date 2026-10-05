import { describe, expect, it } from 'vitest'
import { moveItem, shouldMove } from './reorder'

describe('moveItem', () => {
  it('前から後ろへ動かす', () => {
    expect(moveItem(['A', 'B', 'C', 'D'], 0, 2)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('後ろから前へ動かす', () => {
    expect(moveItem(['A', 'B', 'C', 'D'], 3, 1)).toEqual(['A', 'D', 'B', 'C'])
  })

  it('元の配列は変えない', () => {
    const original = ['A', 'B', 'C']
    moveItem(original, 0, 2)
    expect(original).toEqual(['A', 'B', 'C'])
  })

  it('範囲の外を指定したら何もしない', () => {
    expect(moveItem(['A', 'B'], 0, 5)).toEqual(['A', 'B'])
    expect(moveItem(['A', 'B'], -1, 0)).toEqual(['A', 'B'])
  })
})

describe('shouldMove', () => {
  // 相手の行：上端 100、高さ 40 → 真ん中は 120
  it('下へドラッグ中は、相手の真ん中を越えてから入れ替える', () => {
    expect(shouldMove(0, 1, 110, 100, 40)).toBe(false)
    expect(shouldMove(0, 1, 125, 100, 40)).toBe(true)
  })

  it('上へドラッグ中は、相手の真ん中より上に来てから入れ替える', () => {
    expect(shouldMove(2, 1, 130, 100, 40)).toBe(false)
    expect(shouldMove(2, 1, 115, 100, 40)).toBe(true)
  })

  it('自分の上では入れ替えない', () => {
    expect(shouldMove(1, 1, 120, 100, 40)).toBe(false)
  })
})
