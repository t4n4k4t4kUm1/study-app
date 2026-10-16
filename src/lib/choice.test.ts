import { describe, expect, it } from 'vitest'
import { buildAllChoices, buildChoices, choiceAvailability } from './choice'
import type { Card } from './studySet'

const card = (id: string, question: string, answer: string, position = 0): Card => ({ id, position, question, answer })
const cards = [
  card('c1', '먹다', '食べる'),
  card('c2', '가다', '行く'),
  card('c3', '보다', '見る'),
  card('c4', '자다', '寝る'),
  card('c5', '오다', '来る'),
]

describe('choiceAvailability', () => {
  it('4枚以上なら使える', () => {
    expect(choiceAvailability(4)).toEqual({ ok: true })
  })
  it('4枚未満なら、理由に今の枚数を入れて返す', () => {
    expect(choiceAvailability(3)).toEqual({
      ok: false,
      reason: '4択は、カードが4枚以上あるセットで使えます（いまは3枚）',
    })
  })
})

describe('buildChoices', () => {
  it('正解1つと、ほかのカードの答え3つの、合わせて4つ', () => {
    const options = buildChoices(cards, 'c1', 'forward')
    expect(options).toHaveLength(4)
    expect(options).toContain('食べる')
    expect(new Set(options).size).toBe(4)
    expect(options.every((o) => cards.some((c) => c.answer === o))).toBe(true)
  })

  it('逆向きなら、選択肢は問題の方', () => {
    const options = buildChoices(cards, 'c2', 'reverse')
    expect(options).toContain('가다')
    expect(options.every((o) => cards.some((c) => c.question === o))).toBe(true)
  })

  it('正解の位置は混ざる（いつも1番目ではない）', () => {
    const positions = new Set(Array.from({ length: 40 }, () => buildChoices(cards, 'c1', 'forward').indexOf('食べる')))
    expect(positions.size).toBeGreaterThan(1)
  })

  it('同じ答えのカードがあっても、同じ文の選択肢は並ばない。足りなければ少ない数になる', () => {
    const dup = [card('a', 'Q1', '同じ'), card('b', 'Q2', '同じ'), card('c', 'Q3', '同じ'), card('d', 'Q4', '違う')]
    expect(buildChoices(dup, 'a', 'forward').sort()).toEqual(['同じ', '違う'].sort())
  })

  it('決まった乱数なら、毎回同じ並びになる', () => {
    const fixed = () => 0.42
    expect(buildChoices(cards, 'c3', 'forward', fixed)).toEqual(buildChoices(cards, 'c3', 'forward', fixed))
  })
})

describe('buildAllChoices', () => {
  it('全部のカードの選択肢を、カードの id で引ける', () => {
    const all = buildAllChoices(cards, 'forward')
    expect([...all.keys()]).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
    expect(all.get('c4')).toContain('寝る')
  })
})
