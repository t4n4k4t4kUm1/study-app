// 学習セットとカードの型と、作成・編集フォームの入力を検証・整形する純粋な関数。
// DB や画面に依存しないので、Vitest で単体テストできる。

export type Card = {
  id: string
  position: number // セット内の並び順（0 から）
  question: string // 問題（表）
  answer: string // 答え（裏）
}

/** 一覧表示用（カードの中身は持たず、枚数だけ） */
export type StudySetSummary = {
  id: string
  title: string
  description: string | null
  card_count: number
  created_at: string // ISO 8601（UTC）
}

export type StudySet = {
  id: string
  title: string
  description: string | null
  created_at: string
  cards: Card[] // position の順
}

/** 作成・編集フォームの生の入力。id は編集で「もともとあったカード」にだけ付く */
export type CardDraft = { id?: string; question: string; answer: string }
export type SetDraft = { title: string; description: string; cards: CardDraft[] }

/** 検証済みで、そのまま保存できる形 */
export type NewStudySet = {
  title: string
  description: string | null
  cards: { id?: string; question: string; answer: string }[] // id なし＝新しいカード
}

export const LIMITS = { title: 100, description: 500, question: 500, answer: 500, cards: 500 } as const

export type ParseResult =
  | { ok: true; value: NewStudySet }
  // cardIndex：問題のあるカードの番号（フォームの何行目か、0 から）。画面でその行を目立たせる
  | { ok: false; error: string; cardIndex?: number }

/** 前後の空白を除き、連続する空白を1つにまとめる（全角スペースも対象） */
export function normalizeSpaces(s: string): string {
  return s.replace(/[\s　]+/g, ' ').trim()
}

/** 作成・編集フォームの入力を検証して、保存できる形にする */
export function parseSetDraft(draft: SetDraft): ParseResult {
  const title = normalizeSpaces(draft.title)
  if (title === '') return { ok: false, error: 'タイトルを入力してください' }
  if (title.length > LIMITS.title) return { ok: false, error: `タイトルは${LIMITS.title}文字以内にしてください` }

  const description = draft.description.trim()
  if (description.length > LIMITS.description)
    return { ok: false, error: `説明は${LIMITS.description}文字以内にしてください` }

  const cards: NewStudySet['cards'] = []
  for (const [i, card] of draft.cards.entries()) {
    // 問題・答えは改行を残したいので、前後の空白だけ除く
    const question = card.question.trim()
    const answer = card.answer.trim()
    if (question === '' && answer === '') continue // 両方空の行は無視する（入力欄の余り）
    const n = i + 1
    if (question === '') return { ok: false, error: `${n}枚目の問題が空です`, cardIndex: i }
    if (answer === '') return { ok: false, error: `${n}枚目の答えが空です`, cardIndex: i }
    if (question.length > LIMITS.question)
      return { ok: false, error: `${n}枚目の問題は${LIMITS.question}文字以内にしてください`, cardIndex: i }
    if (answer.length > LIMITS.answer)
      return { ok: false, error: `${n}枚目の答えは${LIMITS.answer}文字以内にしてください`, cardIndex: i }
    cards.push(card.id ? { id: card.id, question, answer } : { question, answer })
  }

  if (cards.length === 0) return { ok: false, error: 'カードを1枚以上入力してください' }
  if (cards.length > LIMITS.cards) return { ok: false, error: `カードは${LIMITS.cards}枚までです` }

  return { ok: true, value: { title, description: description === '' ? null : description, cards } }
}

/** 「3分前」のような相対時刻 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diffSec = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return 'たった今'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}日前`
  return new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
}
