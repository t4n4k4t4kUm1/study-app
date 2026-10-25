import { describe, expect, it } from 'vitest'
import {
  buildBoard,
  currentBoard,
  matchAvailability,
  matchReducer,
  planRetry,
  roundProgress,
  splitBoards,
  startMatch,
  type MatchAction,
  type MatchState,
} from './match'
import type { Card } from './studySet'

const card = (id: string, question: string, answer: string, position = 0): Card => ({ id, position, question, answer })
const AT = '2026-10-25T03:00:00Z'
/** 何回やっても同じ並びになる「乱数」（shuffle では、左に1つずらした並びになる） */
const zero = () => 0

/** 左の札 cardId を選んで、右の札 tileCardId を選ぶ（correct は「同じカードの札か」で決める簡易版） */
function pair(state: MatchState, cardId: string, tileCardId: string, correct = cardId === tileCardId): MatchState {
  const actions: MatchAction[] = [
    { type: 'select', cardId },
    { type: 'pick', tileCardId, given: `答え${tileCardId}`, correct, answeredAt: AT },
  ]
  return actions.reduce(matchReducer, state)
}
const clearBoard = (state: MatchState) => currentBoard(state).reduce((s, id) => pair(s, id, id), state)

describe('matchAvailability', () => {
  it('4枚以上なら使える。足りないときは理由を返す', () => {
    expect(matchAvailability(4)).toEqual({ ok: true })
    expect(matchAvailability(3)).toEqual({
      ok: false,
      reason: 'マッチは、カードが4枚以上あるセットで使えます（いまは3枚）',
    })
  })
})

describe('splitBoards', () => {
  it.each([
    [4, [4]],
    [6, [6]],
    [7, [4, 3]],
    [12, [6, 6]],
    [13, [5, 4, 4]],
    [20, [5, 5, 5, 5]],
    [100, [...Array<number>(15).fill(6), 5, 5]],
  ])('%i枚は、%j 組の盤に分ける（最大6組、大きさはそろえる）', (n, sizes) => {
    const ids = Array.from({ length: n }, (_, i) => `c${i}`)
    const boards = splitBoards(ids)
    expect(boards.map((b) => b.length)).toEqual(sizes)
    expect(boards.flat()).toEqual(ids) // 順番は変えず、抜けも重なりもない
  })

  it('空なら盤はない', () => {
    expect(splitBoards([])).toEqual([])
  })
})

describe('buildBoard', () => {
  const cards = [card('a', '먹다', '食べる'), card('b', '가다', '行く'), card('c', '보다', '見る')]
  const byId = new Map(cards.map((c) => [c.id, c]))

  it('左は問題を順番どおり、右は答えを混ぜて並べる', () => {
    const board = buildBoard(byId, ['a', 'b', 'c'], 'forward', zero)
    expect(board.left).toEqual([
      { cardId: 'a', text: '먹다' },
      { cardId: 'b', text: '가다' },
      { cardId: 'c', text: '보다' },
    ])
    expect(board.right.map((t) => t.cardId)).toEqual(['b', 'c', 'a'])
    expect(board.right[0]).toEqual({ cardId: 'b', text: '行く' })
  })

  it('逆向きなら、左が答え、右が問題', () => {
    const board = buildBoard(byId, ['a', 'b'], 'reverse', zero)
    expect(board.left[0]).toEqual({ cardId: 'a', text: '食べる' })
    expect(board.right.map((t) => t.text).sort()).toEqual(['가다', '먹다'])
  })

  it('右の並びが左とまったく同じになったら、混ぜ直す', () => {
    // 最初の2回は「並びが変わらない」乱数（0.999… は自分自身と入れ替える）、そのあとは 0
    const seq = [0.99, 0.99, 0.99, 0.99]
    let i = 0
    const random = () => seq[i++] ?? 0
    const board = buildBoard(byId, ['a', 'b', 'c'], 'forward', random)
    expect(board.right.map((t) => t.cardId)).not.toEqual(['a', 'b', 'c'])
  })
})

describe('matchReducer', () => {
  it('左を選んで、合う右を選ぶとそろう。全部そろうと「この盤はそろった」になる', () => {
    let s = startMatch('test', ['a', 'b', 'c', 'd'])
    s = matchReducer(s, { type: 'select', cardId: 'a' })
    expect(s.selected).toBe('a')
    s = matchReducer(s, { type: 'pick', tileCardId: 'a', given: '食べる', correct: true, answeredAt: AT })
    expect(s.matched).toEqual(['a'])
    expect(s.selected).toBeNull()
    expect(s.attempts).toEqual([
      { cardId: 'a', round: 1, given: '食べる', judgedCorrect: true, overridden: false, answeredAt: AT },
    ])
    s = ['b', 'c', 'd'].reduce((st, id) => pair(st, id, id), s)
    expect(s.phase).toBe('cleared')
  })

  it('左を選ばずに右を押しても、何も起きない。同じ左をもう一度押すと選ぶのをやめる', () => {
    let s = startMatch('test', ['a', 'b', 'c', 'd'])
    expect(matchReducer(s, { type: 'pick', tileCardId: 'a', given: 'x', correct: true, answeredAt: AT })).toBe(s)
    s = matchReducer(s, { type: 'select', cardId: 'a' })
    expect(matchReducer(s, { type: 'select', cardId: 'a' }).selected).toBeNull()
  })

  it('外したら選ぶのをやめ、そのカードの最初の1回だけを「不正解」で記録する。2回目からは記録しない', () => {
    let s = startMatch('test', ['a', 'b', 'c', 'd'])
    s = pair(s, 'a', 'b') // 外す
    s = pair(s, 'a', 'c') // また外す（記録しない）
    expect(s.selected).toBeNull()
    expect(s.matched).toEqual([])
    s = pair(s, 'a', 'a') // やっと合う（記録しない）
    expect(s.matched).toEqual(['a'])
    expect(s.attempts).toEqual([
      { cardId: 'a', round: 1, given: '答えb', judgedCorrect: false, overridden: false, answeredAt: AT },
    ])
    expect(s.wrong).toEqual(['a'])
  })

  it('そろった左と、使い終わった右は、もう選べない', () => {
    let s = pair(startMatch('test', ['a', 'b', 'c', 'd']), 'a', 'a')
    expect(matchReducer(s, { type: 'select', cardId: 'a' })).toBe(s)
    s = matchReducer(s, { type: 'select', cardId: 'b' })
    expect(matchReducer(s, { type: 'pick', tileCardId: 'a', given: 'x', correct: true, answeredAt: AT })).toBe(s)
  })

  it('同じ答えのカードがあると、別のカードの札でそろえてもよい（右は押した札が消える）', () => {
    let s = startMatch('test', ['big', 'large', 'small', 'tiny'])
    s = pair(s, 'big', 'large', true) // 「大きい」の札はどちらでも正解
    expect(s.matched).toEqual(['big'])
    expect(s.usedTiles).toEqual(['large'])
    s = pair(s, 'large', 'big', true)
    expect(s.usedTiles).toEqual(['large', 'big'])
  })

  it('盤が複数あるときは「次へ」で次の盤。最後の盤のあとは、テストモードなら終わり', () => {
    const ids = Array.from({ length: 7 }, (_, i) => `c${i}`) // 4組と3組の盤
    let s = clearBoard(startMatch('test', ids))
    expect(s.phase).toBe('cleared')
    s = matchReducer(s, { type: 'next' })
    expect(s.boardIndex).toBe(1)
    expect(currentBoard(s)).toEqual(['c4', 'c5', 'c6'])
    expect(s.matched).toEqual([])
    s = pair(s, 'c4', 'c5') // 1つ外す
    s = clearBoard(s)
    s = matchReducer(s, { type: 'next' })
    expect(s.phase).toBe('finished')
    expect(s.attempts).toHaveLength(7) // 1枚につき1回
    expect(s.attempts.filter((a) => !a.judgedCorrect).map((a) => a.cardId)).toEqual(['c4'])
  })

  it('通常モード：最初に外したカードで次の周の盤を作り、全部そろうまで続ける。埋め合わせのカードは記録しない', () => {
    let s = startMatch('normal', ['a', 'b', 'c', 'd'])
    s = pair(s, 'a', 'b') // a を外す
    s = clearBoard(s)
    const nextRound = { boards: [['a', 'c', 'd']], fillers: ['c', 'd'] }
    s = matchReducer(s, { type: 'next', nextRound })
    expect(s.round).toBe(2)
    expect(currentBoard(s)).toEqual(['a', 'c', 'd'])
    expect(s.wrong).toEqual([])
    s = pair(s, 'c', 'd') // 埋め合わせのカードを外しても記録しない
    s = clearBoard(s)
    expect(s.attempts.filter((a) => a.round === 2)).toEqual([
      { cardId: 'a', round: 2, given: '答えa', judgedCorrect: true, overridden: false, answeredAt: AT },
    ])
    s = matchReducer(s, { type: 'next' })
    expect(s.phase).toBe('finished')
  })

  it('通常モードでも、全部最初に合っていれば1周で終わり', () => {
    let s = clearBoard(startMatch('normal', ['a', 'b', 'c', 'd']))
    s = matchReducer(s, { type: 'next' })
    expect(s.phase).toBe('finished')
  })

  it('進み具合：前の盤の組数と、この盤でそろえた組数を足す', () => {
    const ids = Array.from({ length: 7 }, (_, i) => `c${i}`)
    let s = clearBoard(startMatch('test', ids))
    s = matchReducer(s, { type: 'next' })
    s = pair(s, 'c4', 'c4')
    expect(roundProgress(s)).toEqual({ done: 5, total: 7 })
  })
})

describe('planRetry', () => {
  const all = ['a', 'b', 'c', 'd', 'e', 'f']

  it('外したカードが3枚未満なら、ほかのカードで3組まで埋める', () => {
    const r = planRetry(['a'], all, zero)
    expect(r.fillers).toHaveLength(2)
    expect(r.fillers).not.toContain('a')
    expect(r.boards.flat().sort()).toEqual(['a', ...r.fillers].sort())
  })

  it('3枚以上なら埋めない。7枚以上なら盤を分ける', () => {
    expect(planRetry(['a', 'b', 'c'], all, zero).fillers).toEqual([])
    const ids = Array.from({ length: 7 }, (_, i) => `c${i}`)
    expect(planRetry(ids, ids, zero).boards.map((b) => b.length)).toEqual([4, 3])
  })
})
