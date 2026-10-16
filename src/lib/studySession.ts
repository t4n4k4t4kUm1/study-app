// 学習の記録（1回の学習＝セッション）の型と、表示用の小さな関数。
import type { Attempt, TypingMode } from './typing'

/** forward：問題を見て答えを打つ / reverse：答えを見て問題を打つ */
export type Direction = 'forward' | 'reverse'

/** どの形式で学んだか。typing：入力（キーボードで答える） / choice：4択 */
export type StudyMethod = 'typing' | 'choice'

export const METHOD_LABELS: Record<StudyMethod, string> = {
  typing: '入力',
  choice: '4択',
}

/** 保存するときに渡すもの */
export type NewStudySession = {
  setId: string
  method: StudyMethod
  mode: TypingMode
  direction: Direction
  startedAt: string
  attempts: Attempt[]
}

/** 一覧に出すもの */
export type StudySessionSummary = {
  id: string
  method: StudyMethod
  mode: TypingMode
  direction: Direction
  finished_at: string
  first_round_correct: number
  first_round_total: number
}

export const MODE_LABELS: Record<TypingMode, string> = {
  normal: '通常',
  test: 'テスト',
  thorough: '徹底',
}

/** 「10/6 14:03」のような日本時間の表示 */
export function formatJst(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 正答率（%）。0問なら 0 */
export function percent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100)
}
