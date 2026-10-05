import { describe, expect, it } from 'vitest'
import { exactJudge } from './judge'
import {
  currentCardId,
  firstRoundMistakes,
  firstRoundScore,
  startTyping,
  typingReducer,
  type TypingAction,
  type TypingState,
} from './typing'

const at = '2026-10-06T05:00:00Z'
const ok: TypingAction = { type: 'submit', given: '正', judgedCorrect: true, answeredAt: at }
const ng: TypingAction = { type: 'submit', given: '誤', judgedCorrect: false, answeredAt: at }
const next: TypingAction = { type: 'next' }
const run = (state: TypingState, ...actions: TypingAction[]) => actions.reduce(typingReducer, state)

describe('exactJudge（完全一致）', () => {
  it('同じなら正解、1文字でも違えば不正解', () => {
    expect(exactJudge('食べる', '食べる')).toBe(true)
    expect(exactJudge('食べる', 'たべる')).toBe(false)
    expect(exactJudge('ABC', 'abc')).toBe(false) // 大文字・小文字も区別する
  })

  it('前後の空白と、正解の中の改行だけは気にしない', () => {
    expect(exactJudge('食べる', '  食べる ')).toBe(true)
    expect(exactJudge('1行目\n2行目', '1行目 2行目')).toBe(true)
  })
})

describe('通常モード', () => {
  it('間違えたカードは次の周にもう一度出て、全部正解すると終わる。点数は1周目', () => {
    let s = startTyping('normal', ['a', 'b', 'c'])
    s = run(s, ok, next, ng, next, ng, next) // a 正解、b・c 不正解
    expect(s).toMatchObject({ round: 2, queue: ['b', 'c'], phase: 'answering' })

    s = run(s, ok, next, ng, next) // 2周目：b 正解、c まだ不正解
    expect(s).toMatchObject({ round: 3, queue: ['c'] })

    s = run(s, ok, next) // 3周目：c 正解
    expect(s.phase).toBe('finished')
    expect(firstRoundScore(s)).toEqual({ correct: 1, total: 3 })
    expect(firstRoundMistakes(s).map((a) => a.cardId)).toEqual(['b', 'c'])
  })

  it('次の周の順番は外から渡せる（シャッフル用）', () => {
    const s = run(startTyping('normal', ['a', 'b']), ng, next, ng, { type: 'next', nextOrder: ['b', 'a'] })
    expect(s.queue).toEqual(['b', 'a'])
  })
})

describe('テストモード', () => {
  it('間違えても1周で終わる', () => {
    const s = run(startTyping('test', ['a', 'b']), ng, next, ok, next)
    expect(s.phase).toBe('finished')
    expect(firstRoundScore(s)).toEqual({ correct: 1, total: 2 })
  })
})

describe('徹底モード', () => {
  it('間違えたら打ち直し。違っていたら進めず、合っていたら次へ（打ち直しは記録しない）', () => {
    let s = run(startTyping('thorough', ['a', 'b']), ng)
    expect(s.phase).toBe('retyping')

    s = run(s, { type: 'retype', correct: false })
    expect(s).toMatchObject({ phase: 'retyping', retypeMissed: true, index: 0 })

    s = run(s, { type: 'retype', correct: true })
    expect(s).toMatchObject({ phase: 'answering', retypeMissed: false })
    expect(currentCardId(s)).toBe('b')
    expect(s.attempts).toHaveLength(1)
  })
})

describe('正解にする', () => {
  it('不正解の答えを正解に変え、次の周にも出なくなる。判定係の判定は残る', () => {
    let s = run(startTyping('normal', ['a', 'b']), ng, { type: 'override' })
    expect(s.attempts[0]).toMatchObject({ judgedCorrect: false, overridden: true })
    s = run(s, next, ok, next)
    expect(s.phase).toBe('finished')
    expect(firstRoundScore(s)).toEqual({ correct: 2, total: 2 })
  })

  it('徹底モードの打ち直し中に押すと、打ち直さずに進める', () => {
    const s = run(startTyping('thorough', ['a', 'b']), ng, { type: 'override' }, next)
    expect(currentCardId(s)).toBe('b')
  })

  it('正解の答えには押せない', () => {
    const s = run(startTyping('normal', ['a']), ok)
    expect(run(s, { type: 'override' })).toBe(s)
  })
})

it('答えている途中で「次へ」は効かない', () => {
  const s = startTyping('normal', ['a'])
  expect(run(s, next)).toBe(s)
})
