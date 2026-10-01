import { describe, expect, it } from 'vitest'
import { deckReducer, initDeck, isFinished, shuffle, type DeckAction, type DeckState } from './deck'

const run = (state: DeckState, ...actions: DeckAction[]) => actions.reduce(deckReducer, state)

describe('deckReducer', () => {
  it('最初は1枚目の表', () => {
    expect(initDeck(3)).toEqual({ order: [0, 1, 2], index: 0, flipped: false, answerFirst: false })
  })

  it('めくると裏、もう一度めくると表', () => {
    const s = run(initDeck(3), { type: 'flip' })
    expect(s.flipped).toBe(true)
    expect(run(s, { type: 'flip' }).flipped).toBe(false)
  })

  it('次へ進むと表に戻る', () => {
    const s = run(initDeck(3), { type: 'flip' }, { type: 'next' })
    expect(s).toMatchObject({ index: 1, flipped: false })
  })

  it('最初のカードで「前へ」は何も変えない', () => {
    const s = initDeck(3)
    expect(run(s, { type: 'prev' })).toBe(s)
  })

  it('最後のカードの次は「めくり終わった」状態になり、前へで最後のカードに戻れる', () => {
    const done = run(initDeck(2), { type: 'next' }, { type: 'next' })
    expect(isFinished(done)).toBe(true)
    expect(run(done, { type: 'next' })).toBe(done) // それ以上は進まない
    expect(run(done, { type: 'prev' })).toMatchObject({ index: 1 })
  })

  it('シャッフルは渡された順番で最初から、最初からは元の順番に戻す', () => {
    const shuffled = run(initDeck(3), { type: 'next' }, { type: 'shuffle', order: [2, 0, 1] })
    expect(shuffled).toMatchObject({ order: [2, 0, 1], index: 0 })
    expect(run(shuffled, { type: 'restart' })).toMatchObject({ order: [0, 1, 2], index: 0 })
  })

  it('「答えを先に」を切り替えると表に戻る', () => {
    const s = run(initDeck(3), { type: 'flip' }, { type: 'toggleAnswerFirst' })
    expect(s).toMatchObject({ answerFirst: true, flipped: false })
  })
})

describe('shuffle', () => {
  it('要素は同じで、元の配列は変えない', () => {
    const original = [0, 1, 2, 3, 4]
    const result = shuffle(original)
    expect([...result].sort()).toEqual(original)
    expect(original).toEqual([0, 1, 2, 3, 4])
  })

  it('乱数を固定すると結果も決まる', () => {
    // random() が常に 0 → 各ステップで先頭と入れ替わる
    expect(shuffle([0, 1, 2, 3], () => 0)).toEqual([1, 2, 3, 0])
  })
})
