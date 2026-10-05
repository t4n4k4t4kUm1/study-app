// 入力モード（キーボードで答える学習）の状態と、その変え方。カード学習の deck.ts と同じ考え方の「ルールブック」。
// 正しいかどうかの判定（judge.ts）や、並べ替えの乱数は外から渡すので、この関数は同じ入力なら必ず同じ結果になる。
//
// 3つのモード
//   normal（通常）  ：1周したあと、間違えた問題だけをもう一度。全部正解するまで続ける。点数は1周目で数える
//   test（テスト）  ：1周だけ。間違えたら正解を見て次へ
//   thorough（徹底）：間違えたら、正しい答えを打ち直すまで次に進めない。点数は最初の答えで数える

export type TypingMode = 'normal' | 'test' | 'thorough'

/** 1回の答え。DB の answer_logs の1行になる */
export type Attempt = {
  cardId: string
  round: number // 何周目か（1 から）
  given: string // 打った答え（空なら「わからない」）
  judgedCorrect: boolean // 判定係の判定
  overridden: boolean // 「正解にする」を押したか
  answeredAt: string // ISO 8601
}

/** 判定係の判定か「正解にする」のどちらかで正解なら、正解として扱う */
export const isCorrect = (a: Attempt) => a.judgedCorrect || a.overridden

// answering：答えを打つ / feedback：正解・不正解を見る / retyping：（徹底モード）正解を打ち直す / finished：終わり
export type TypingPhase = 'answering' | 'feedback' | 'retyping' | 'finished'

export type TypingState = {
  mode: TypingMode
  round: number
  queue: string[] // この周で出すカード（id）の順番
  index: number // queue の何番目か
  phase: TypingPhase
  attempts: Attempt[] // これまでの全部の答え
  wrong: string[] // この周で間違えたカード（次の周で出す）
  retypeMissed: boolean // 打ち直しが合っていなかった（「もう一度」と出す）
}

export type TypingAction =
  | { type: 'submit'; given: string; judgedCorrect: boolean; answeredAt: string }
  | { type: 'override' }
  // nextOrder：次の周に進むときの出題順（シャッフルするかは画面側が決める）。省略したら間違えた順
  | { type: 'retype'; correct: boolean; nextOrder?: string[] }
  | { type: 'next'; nextOrder?: string[] }

export function startTyping(mode: TypingMode, order: string[]): TypingState {
  return {
    mode,
    round: 1,
    queue: order,
    index: 0,
    phase: order.length === 0 ? 'finished' : 'answering',
    attempts: [],
    wrong: [],
    retypeMissed: false,
  }
}

export function currentCardId(state: TypingState): string | null {
  return state.phase === 'finished' ? null : (state.queue[state.index] ?? null)
}

export function lastAttempt(state: TypingState): Attempt | undefined {
  return state.attempts.at(-1)
}

/** 1周目の点数（「正解にする」を押したものも正解に数える） */
export function firstRoundScore(state: TypingState): { correct: number; total: number } {
  const first = state.attempts.filter((a) => a.round === 1)
  return { correct: first.filter(isCorrect).length, total: first.length }
}

/** 1周目に間違えた答え（結果画面で見せる） */
export function firstRoundMistakes(state: TypingState): Attempt[] {
  return state.attempts.filter((a) => a.round === 1 && !isCorrect(a))
}

/** 次のカードへ。周の終わりなら、通常モードで間違いが残っていれば次の周、なければ終わり */
function advance(state: TypingState, nextOrder?: string[]): TypingState {
  const base = { ...state, retypeMissed: false }
  if (state.index + 1 < state.queue.length) return { ...base, index: state.index + 1, phase: 'answering' }
  if (state.mode === 'normal' && state.wrong.length > 0) {
    return { ...base, round: state.round + 1, queue: nextOrder ?? state.wrong, index: 0, wrong: [], phase: 'answering' }
  }
  return { ...base, phase: 'finished' }
}

export function typingReducer(state: TypingState, action: TypingAction): TypingState {
  switch (action.type) {
    case 'submit': {
      const cardId = currentCardId(state)
      if (state.phase !== 'answering' || cardId === null) return state
      const attempt: Attempt = {
        cardId,
        round: state.round,
        given: action.given,
        judgedCorrect: action.judgedCorrect,
        overridden: false,
        answeredAt: action.answeredAt,
      }
      return {
        ...state,
        attempts: [...state.attempts, attempt],
        wrong: action.judgedCorrect ? state.wrong : [...state.wrong, cardId],
        phase: !action.judgedCorrect && state.mode === 'thorough' ? 'retyping' : 'feedback',
      }
    }
    case 'override': {
      // 直前の答えが不正解のときだけ「正解にする」ができる
      const last = lastAttempt(state)
      if ((state.phase !== 'feedback' && state.phase !== 'retyping') || !last || isCorrect(last)) return state
      return {
        ...state,
        attempts: [...state.attempts.slice(0, -1), { ...last, overridden: true }],
        wrong: state.wrong.filter((id) => id !== last.cardId),
        phase: 'feedback',
        retypeMissed: false,
      }
    }
    case 'retype':
      if (state.phase !== 'retyping') return state
      // 打ち直しは練習なので記録（attempts）には入れない。合っていたら次へ進む
      return action.correct ? advance(state, action.nextOrder) : { ...state, retypeMissed: true }
    case 'next':
      return state.phase === 'feedback' ? advance(state, action.nextOrder) : state
  }
}
