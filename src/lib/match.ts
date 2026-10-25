// マッチ（問題と答えの組み合わせを選ぶ学習）のルールブック。画面とは関係なく、同じ入力なら必ず同じ結果になる。
// 机にカードを2列に並べ、左の問題を1つ選んでから、右の合う答えを選ぶ。合えば2枚がそろい、全部そろえば次の盤へ。
//
// 2つのモード
//   normal（通常）：1周したあと、最初の1回を間違えた組だけで、もう一度盤を作る。全部そろうまで続ける
//   test（テスト）：1周だけ
// 入力・4択の「徹底」（正解するまで進めない）は、マッチでは元からそうなっているのでない。
//
// 点数は、入力・4択と同じく「1周目に、各カードで最初に選んだ答えが合っていたか」で数える。
// 何度か外して最後に合わせても、記録に残るのは最初の1回だけ（2回目からは練習）。
import { shuffle } from './deck'
import { correctTextOf } from './choice'
import type { Card } from './studySet'
import type { Direction } from './studySession'
import type { Attempt } from './typing'

/** 1つの盤に並べる組の最大数 */
export const MATCH_BOARD_SIZE = 6
/** マッチが使える最小のカード枚数 */
export const MIN_CARDS_FOR_MATCH = 4
/** 1つの盤の最小の組数（2組以下だと、最後の1組が考えなくても決まってしまう） */
export const MIN_BOARD_PAIRS = 3

export type MatchMode = 'normal' | 'test'

/** マッチが使えるか。使えないときは、その理由（吹き出しに出す文） */
export function matchAvailability(cardCount: number): { ok: true } | { ok: false; reason: string } {
  if (cardCount >= MIN_CARDS_FOR_MATCH) return { ok: true }
  return {
    ok: false,
    reason: `マッチは、カードが${MIN_CARDS_FOR_MATCH}枚以上あるセットで使えます（いまは${cardCount}枚）`,
  }
}

/**
 * カードを盤に分ける。1つの盤は最大 size 組で、盤どうしの大きさはできるだけそろえる。
 * 例：20枚 → 5・5・5・5、7枚 → 4・3（6・1 にすると、1組だけの盤ができてしまうため）
 */
export function splitBoards<T>(items: T[], size = MATCH_BOARD_SIZE): T[][] {
  if (items.length === 0) return []
  const count = Math.ceil(items.length / size)
  const base = Math.floor(items.length / count)
  const extra = items.length % count // 最初の extra 個の盤は1組多くする
  const boards: T[][] = []
  let start = 0
  for (let i = 0; i < count; i++) {
    const len = base + (i < extra ? 1 : 0)
    boards.push(items.slice(start, start + len))
    start += len
  }
  return boards
}

/** 盤の札1枚。cardId はどのカードの札か、text は札に書く文字 */
export type Tile = { cardId: string; text: string }
export type Board = { left: Tile[]; right: Tile[] }

/** 左の列（問題側）に書く文字。forward なら問題、reverse（逆向き）なら答え */
export const promptTextOf = (card: Card, direction: Direction) =>
  direction === 'reverse' ? card.answer : card.question

/**
 * 1つの盤の札を作る。左は ids の順、右はばらばらに混ぜる（左と同じ並びになったら混ぜ直す）。
 * random：0 以上 1 未満を返す関数（テストでは決まった数を返すものに替えられる）
 */
export function buildBoard(
  cardsById: Map<string, Card>,
  ids: string[],
  direction: Direction,
  random: () => number = Math.random,
): Board {
  const cards = ids.map((id) => cardsById.get(id)).filter((c): c is Card => c !== undefined)
  const left = cards.map((c) => ({ cardId: c.id, text: promptTextOf(c, direction) }))
  let order = shuffle(cards, random)
  for (let tries = 0; tries < 5 && cards.length > 1 && order.every((c, i) => c.id === cards[i].id); tries++) {
    order = shuffle(cards, random)
  }
  const right = order.map((c) => ({ cardId: c.id, text: correctTextOf(c, direction) }))
  return { left, right }
}

// playing：選んでいる / cleared：この盤がそろった（「次へ」を待つ） / finished：終わり
export type MatchPhase = 'playing' | 'cleared' | 'finished'

export type MatchState = {
  mode: MatchMode
  round: number // 何周目か（1 から）
  boards: string[][] // この周の盤（それぞれカードの id の並び）
  boardIndex: number // いま何番目の盤か
  fillers: string[] // 通常の2周目以降で、盤を埋めるために足したカード（記録しない）
  selected: string | null // 選んでいる左の札（カードの id）
  matched: string[] // この盤でそろった左の札
  usedTiles: string[] // この盤で使い終わった右の札（同じ答えのカードがあると、matched と違うことがある）
  tried: string[] // この周で、最初の1回をもう記録したカード
  wrong: string[] // この周で、最初の1回を間違えたカード（通常モードの次の周に出す）
  attempts: Attempt[] // 記録する答え（DB の answer_logs になる）
  phase: MatchPhase
}

export type NextRound = { boards: string[][]; fillers: string[] }

export type MatchAction =
  | { type: 'select'; cardId: string }
  // tileCardId：選んだ右の札のカード、given：その札の文字、correct：左の札の正しい答えと同じ文字か（画面側で判定する）
  | { type: 'pick'; tileCardId: string; given: string; correct: boolean; answeredAt: string }
  // nextRound：通常モードで次の周に進むときの盤（並べ方や埋め合わせの選び方は乱数を使うので、画面側が planRetry で作る）
  | { type: 'next'; nextRound?: NextRound }

export function startMatch(mode: MatchMode, order: string[]): MatchState {
  return {
    mode,
    round: 1,
    boards: splitBoards(order),
    boardIndex: 0,
    fillers: [],
    selected: null,
    matched: [],
    usedTiles: [],
    tried: [],
    wrong: [],
    attempts: [],
    phase: order.length === 0 ? 'finished' : 'playing',
  }
}

/** いまの盤のカード（id の並び） */
export const currentBoard = (state: MatchState): string[] => state.boards[state.boardIndex] ?? []

/** この盤が、この周の最後の盤か */
export const isLastBoard = (state: MatchState) => state.boardIndex === state.boards.length - 1

/** この周で、すでにそろえた組の数と、全部の組の数（進み具合のバーに使う。埋め合わせも含む） */
export function roundProgress(state: MatchState): { done: number; total: number } {
  const total = state.boards.reduce((n, b) => n + b.length, 0)
  const before = state.boards.slice(0, state.boardIndex).reduce((n, b) => n + b.length, 0)
  const done = state.phase === 'finished' ? total : before + state.matched.length
  return { done, total }
}

/**
 * 通常モードの次の周の盤を作る。最初の1回を間違えたカードで盤を作り、
 * 3組に足りなければ、ほかのカード（埋め合わせ。記録しない）で埋める。
 */
export function planRetry(wrong: string[], allIds: string[], random: () => number = Math.random): NextRound {
  const need = Math.max(0, MIN_BOARD_PAIRS - wrong.length)
  const fillers = shuffle(
    allIds.filter((id) => !wrong.includes(id)),
    random,
  ).slice(0, need)
  return { boards: splitBoards(shuffle([...wrong, ...fillers], random)), fillers }
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'select': {
      // そろった札は選べない。同じ札をもう一度押したら、選ぶのをやめる
      if (state.phase !== 'playing' || !currentBoard(state).includes(action.cardId)) return state
      if (state.matched.includes(action.cardId)) return state
      return { ...state, selected: state.selected === action.cardId ? null : action.cardId }
    }
    case 'pick': {
      const cardId = state.selected
      if (state.phase !== 'playing' || cardId === null) return state
      if (!currentBoard(state).includes(action.tileCardId) || state.usedTiles.includes(action.tileCardId)) return state

      // そのカードの、この周での最初の1回だけを記録する（埋め合わせのカードは記録しない）
      const record = !state.tried.includes(cardId) && !state.fillers.includes(cardId)
      const attempts = record
        ? [
            ...state.attempts,
            {
              cardId,
              round: state.round,
              given: action.given,
              judgedCorrect: action.correct,
              overridden: false,
              answeredAt: action.answeredAt,
            },
          ]
        : state.attempts
      const tried = record ? [...state.tried, cardId] : state.tried
      const wrong = record && !action.correct ? [...state.wrong, cardId] : state.wrong

      if (!action.correct) return { ...state, attempts, tried, wrong, selected: null }

      const matched = [...state.matched, cardId]
      const usedTiles = [...state.usedTiles, action.tileCardId]
      const cleared = matched.length === currentBoard(state).length
      return {
        ...state,
        attempts,
        tried,
        wrong,
        matched,
        usedTiles,
        selected: null,
        phase: cleared ? 'cleared' : 'playing',
      }
    }
    case 'next': {
      if (state.phase !== 'cleared') return state
      const fresh = { selected: null, matched: [], usedTiles: [], phase: 'playing' as const }
      if (!isLastBoard(state)) return { ...state, ...fresh, boardIndex: state.boardIndex + 1 }
      if (state.mode === 'normal' && state.wrong.length > 0) {
        const next = action.nextRound ?? { boards: splitBoards(state.wrong), fillers: [] }
        return {
          ...state,
          ...fresh,
          round: state.round + 1,
          boards: next.boards,
          fillers: next.fillers,
          boardIndex: 0,
          tried: [],
          wrong: [],
        }
      }
      return { ...state, selected: null, phase: 'finished' }
    }
  }
}
