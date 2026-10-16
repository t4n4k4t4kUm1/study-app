import { describe, expect, it } from 'vitest'
import { answerCredits, firstRoundCreditAnswers, formatCredits, sessionCredits, type CreditAnswer } from './credits'
import type { Attempt } from './typing'

const ok: CreditAnswer = { claimedCorrect: true, verified: true }
const self: CreditAnswer = { claimedCorrect: true, verified: false }
const ng: CreditAnswer = { claimedCorrect: false, verified: false }
const times = (a: CreditAnswer, n: number) => Array.from({ length: n }, () => a)

describe('answerCredits', () => {
  it('完全一致の正解は100、「正解にする」は50、不正解は0', () => {
    expect(answerCredits(ok)).toBe(100)
    expect(answerCredits(self)).toBe(50)
    expect(answerCredits(ng)).toBe(0)
  })
})

describe('sessionCredits', () => {
  it('20問中16問正解（正答率80%）なら 1600 × 1.3 = 2080', () => {
    expect(sessionCredits([...times(ok, 16), ...times(ng, 4)])).toBe(2080)
  })

  it('全問正解は1.5倍、半分正解は1倍', () => {
    expect(sessionCredits(times(ok, 10))).toBe(1500)
    expect(sessionCredits([...times(ok, 5), ...times(ng, 5)])).toBe(500)
  })

  it('「正解にする」も正答率には数えるが、1問50', () => {
    // (100 + 100 + 50) × (0.5 + 3/4) = 312.5 → 四捨五入で 313（DB のテストと同じ例）
    expect(sessionCredits([ok, ok, self, ng])).toBe(313)
  })

  it('全部不正解・問題なしは0', () => {
    expect(sessionCredits(times(ng, 5))).toBe(0)
    expect(sessionCredits([])).toBe(0)
  })

  it('問題数が多いほど多くもらえる（正答率が同じなら、ほぼ問題数に比例）', () => {
    expect(sessionCredits(times(ok, 40))).toBe(2 * sessionCredits(times(ok, 20)))
  })
})

describe('firstRoundCreditAnswers', () => {
  const attempt = (over: Partial<Attempt>): Attempt => ({
    cardId: 'c1',
    round: 1,
    given: '固有値',
    judgedCorrect: true,
    overridden: false,
    answeredAt: '2026-10-16T00:00:00Z',
    ...over,
  })
  const expectedOf = (id: string) => ({ c1: '固有値', c2: '行く' })[id]

  it('2周目以降は数えない。正解と判定されていても、答えと一致しなければ満額にしない', () => {
    expect(
      firstRoundCreditAnswers(
        [
          attempt({}),
          attempt({ cardId: 'c2', given: 'いく', judgedCorrect: false, overridden: true }),
          attempt({ cardId: 'c2', given: 'でたらめ' }), // 画面の判定係が「正解」と言っても、一致しない
          attempt({ cardId: 'c2', round: 2, given: '行く' }),
        ],
        expectedOf,
      ),
    ).toEqual([
      { claimedCorrect: true, verified: true },
      { claimedCorrect: true, verified: false },
      { claimedCorrect: true, verified: false },
    ])
  })
})

describe('formatCredits', () => {
  it('3桁ごとに区切る', () => {
    expect(formatCredits(1234567)).toBe('1,234,567')
    expect(formatCredits(0)).toBe('0')
  })
})
