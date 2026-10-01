// 「覚えたいこと」（item）の型と、入力を検証・整形する純粋な関数。
// DB や画面に依存しないので、Vitest で単体テストできる。

export type Item = {
  id: string
  term: string // 用語（問題の答えになるもの）
  note: string | null // 説明（意味・定義）
  subject: string // 科目。未分類は空文字
  source: string | null // 出会った場所（授業名・動画名など）
  created_at: string // ISO 8601（UTC）
}

export type NewItem = Pick<Item, 'term' | 'note' | 'subject' | 'source'>

export type ItemInput = {
  term: string
  note: string
  subject: string
  source: string
}

export const LIMITS = { term: 200, note: 2000, subject: 50, source: 200 } as const

export type ParseResult = { ok: true; value: NewItem } | { ok: false; error: string }

/** 前後の空白を除き、連続する空白を1つにまとめる（全角スペースも対象） */
export function normalizeSpaces(s: string): string {
  return s.replace(/[\s　]+/g, ' ').trim()
}

/** 空文字なら null にする（任意項目用） */
function emptyToNull(s: string): string | null {
  const v = normalizeSpaces(s)
  return v === '' ? null : v
}

/** フォームの入力を検証して、DB に保存できる形にする */
export function parseItemInput(input: ItemInput): ParseResult {
  const term = normalizeSpaces(input.term)
  if (term === '') return { ok: false, error: '用語を入力してください' }
  if (term.length > LIMITS.term) return { ok: false, error: `用語は${LIMITS.term}文字以内にしてください` }

  const subject = normalizeSpaces(input.subject)
  if (subject.length > LIMITS.subject) return { ok: false, error: `科目は${LIMITS.subject}文字以内にしてください` }

  // 説明は改行を残したいので、前後の空白だけ除く
  const noteTrimmed = input.note.trim()
  if (noteTrimmed.length > LIMITS.note) return { ok: false, error: `説明は${LIMITS.note}文字以内にしてください` }

  const source = emptyToNull(input.source)
  if (source && source.length > LIMITS.source)
    return { ok: false, error: `出会った場所は${LIMITS.source}文字以内にしてください` }

  return {
    ok: true,
    value: { term, subject, note: noteTrimmed === '' ? null : noteTrimmed, source },
  }
}

/** 一覧から、使ったことのある科目を新しい順・重複なしで取り出す（入力候補用） */
export function recentSubjects(items: Item[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    if (item.subject !== '' && !seen.has(item.subject)) {
      seen.add(item.subject)
      result.push(item.subject)
    }
  }
  return result
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
