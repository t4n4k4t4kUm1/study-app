// カード学習（めくって覚える形式）の状態と、その変え方。
// 「今どのカードか」「表か裏か」「順番」を1つの状態にまとめ、
// 操作（めくる・次へ・前へ…）ごとに新しい状態を返す純粋な関数（reducer）にしている。
// 画面は React の useReducer でこれを使う。乱数は外から渡すので、テストで結果を固定できる。

export type DeckState = {
  order: number[] // 出す順番（cards 配列の添字の並び）
  index: number // order の何番目を見ているか。order.length と等しいときは「全部めくり終わった」
  flipped: boolean // 裏（2面目）を見ているか
  answerFirst: boolean // true なら答えを表にして出す（逆向きの練習）
}

export type DeckAction =
  | { type: 'flip' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'restart' } // 元の順番で最初から
  | { type: 'shuffle'; order: number[] } // 並べ替えた順番で最初から
  | { type: 'toggleAnswerFirst' }

export function initDeck(count: number): DeckState {
  return { order: range(count), index: 0, flipped: false, answerFirst: false }
}

export function isFinished(state: DeckState): boolean {
  return state.index >= state.order.length
}

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case 'flip':
      return isFinished(state) ? state : { ...state, flipped: !state.flipped }
    case 'next':
      return isFinished(state) ? state : { ...state, index: state.index + 1, flipped: false }
    case 'prev':
      return state.index === 0 ? state : { ...state, index: state.index - 1, flipped: false }
    case 'restart':
      return { ...state, order: range(state.order.length), index: 0, flipped: false }
    case 'shuffle':
      return { ...state, order: action.order, index: 0, flipped: false }
    case 'toggleAnswerFirst':
      return { ...state, answerFirst: !state.answerFirst, flipped: false }
  }
}

/** 0, 1, ..., n-1 */
export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

/** フィッシャー–イェーツのシャッフル。元の配列は変えずに新しい配列を返す */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
