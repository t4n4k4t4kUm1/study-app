// 「まとめて貼り付け」の読み取り係。貼られた文字を、カード（問題と答えの組）の並びに分ける。
// 1行が1枚で、問題と答えは「区切り」（タブ・カンマ・自分で決めた記号）で分かれている。
// Excel や Google スプレッドシートの2列をコピーすると「問題<タブ>答え」の行が並んだ形になるので、タブを初期値にしている。
// セルの中に改行があると、スプレッドシートはそのセルを "…" で囲んでコピーする。これも1枚として読む。
import { LIMITS, type CardDraft } from './studySet'

export type SeparatorKind = 'tab' | 'comma' | 'custom'

/** 画面に出す区切りの名前（エラー文でも使う） */
export const SEPARATOR_LABELS: Record<SeparatorKind, string> = { tab: 'タブ', comma: 'カンマ', custom: '区切り' }

/** 区切りの種類から、実際に探す文字を決める。自分で決める区切りが使えないときは、その理由 */
export function resolveSeparator(
  kind: SeparatorKind,
  custom: string,
): { ok: true; separator: string } | { ok: false; reason: string } {
  if (kind === 'tab') return { ok: true, separator: '\t' }
  if (kind === 'comma') return { ok: true, separator: ',' }
  if (custom === '') return { ok: false, reason: '区切りに使う記号を入力してください' }
  // 改行は「次のカード」、" は「セルの囲み」の意味で使っているので、区切りにはできない
  if (/[\n\r"]/.test(custom)) return { ok: false, reason: '区切りに改行や " は使えません' }
  return { ok: true, separator: custom }
}

/** 読めなかった行。line は貼った文字の何行目か（1 から） */
export type BulkError = { line: number; reason: string }

export type BulkResult = {
  cards: { question: string; answer: string }[]
  errors: BulkError[]
}

/**
 * 貼られた文字を読む。
 * - 空の行は飛ばす
 * - 区切りがない行・問題か答えが空の行・長すぎる行・3列以上ある行はエラー（何行目か付き）
 * - 問題と答えは、前後の空白を除く（フォームで保存するときと同じ）
 */
export function parseBulk(text: string, separator: string, label = '区切り'): BulkResult {
  const cards: BulkResult['cards'] = []
  const errors: BulkError[] = []

  for (const { line, fields } of splitRecords(normalizeNewlines(text), separator)) {
    // 行の最後に空の列が続くのは無視する（スプレッドシートで1列多く選んでコピーしたとき）
    while (fields.length > 2 && fields[fields.length - 1].trim() === '') fields.pop()
    if (fields.every((f) => f.trim() === '')) continue // 空の行

    if (fields.length === 1) {
      errors.push({ line, reason: `${label}が見つかりません` })
      continue
    }
    if (fields.length > 2) {
      errors.push({
        line,
        reason: `${label}が2つ以上あります。答えに${label}が入るなら、"…" で囲むか、別の区切りにしてください`,
      })
      continue
    }
    const question = fields[0].trim()
    const answer = fields[1].trim()
    if (question === '') errors.push({ line, reason: '問題が空です' })
    else if (answer === '') errors.push({ line, reason: '答えが空です' })
    else if (question.length > LIMITS.question)
      errors.push({ line, reason: `問題が${LIMITS.question}文字を超えています（${question.length}文字）` })
    else if (answer.length > LIMITS.answer)
      errors.push({ line, reason: `答えが${LIMITS.answer}文字を超えています（${answer.length}文字）` })
    else cards.push({ question, answer })
  }
  return { cards, errors }
}

/** Windows の改行（\r\n）や古い Mac の改行（\r）を \n にそろえ、先頭の BOM（Excel で保存したファイルに付く印）を除く */
function normalizeNewlines(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
}

/**
 * 文字を「行」と「列」に分ける。"…" で囲まれた列の中では、改行や区切りも文字として扱う（"" は " 1つ）。
 * 囲みが閉じていない（例：「"to be" の意味」のように、" のあとに区切りや改行が来ない）ときは、" もふつうの文字として読む。
 */
function* splitRecords(text: string, sep: string): Generator<{ line: number; fields: string[] }> {
  let i = 0
  let line = 1
  while (i < text.length) {
    const startLine = line
    const fields: string[] = []
    while (true) {
      const quoted = text[i] === '"' ? readQuoted(text, i + 1, sep) : null
      let field: string
      if (quoted) {
        field = quoted.value
        line += quoted.newlines
        i = quoted.end
      } else {
        let end = i
        while (end < text.length && text[end] !== '\n' && !text.startsWith(sep, end)) end++
        field = text.slice(i, end)
        i = end
      }
      fields.push(field)
      if (text.startsWith(sep, i)) {
        i += sep.length // 次の列へ
        continue
      }
      break // 行の終わり（改行か、文字の終わり）
    }
    if (text[i] === '\n') {
      i++
      line++
    }
    yield { line: startLine, fields }
  }
}

/** "…" の中身を読む。閉じる " のすぐ後ろが区切り・改行・文字の終わりのときだけ成功 */
function readQuoted(text: string, start: number, sep: string): { value: string; end: number; newlines: number } | null {
  let value = ''
  let newlines = 0
  let j = start
  while (j < text.length) {
    const ch = text[j]
    if (ch === '"') {
      if (text[j + 1] === '"') {
        value += '"'
        j += 2
        continue
      }
      const after = j + 1
      if (after === text.length || text[after] === '\n' || text.startsWith(sep, after)) {
        return { value, end: after, newlines }
      }
      return null
    }
    if (ch === '\n') newlines++
    value += ch
    j++
  }
  return null
}

/**
 * 読めたカードをフォームの行に足す。中身が空の行（新しく作る画面の、最初の空欄など）は先に埋め、残りを最後に足す。
 * makeRow：行を作る関数（画面側で、行を見分ける番号を付けるため）
 */
export function mergeIntoRows<R extends CardDraft>(
  rows: R[],
  cards: { question: string; answer: string }[],
  makeRow: (card: { question: string; answer: string }) => R,
): R[] {
  const queue = [...cards]
  const filled = rows.map((r) => {
    const empty = r.question.trim() === '' && r.answer.trim() === '' && !r.id
    if (!empty || queue.length === 0) return r
    const card = queue.shift()!
    return { ...r, question: card.question, answer: card.answer }
  })
  return [...filled, ...queue.map(makeRow)]
}

/** 今あるカードの枚数（中身の入った行）。足したあとに上限を超えないかを調べるのに使う */
export const countNonEmptyRows = (rows: CardDraft[]) =>
  rows.filter((r) => r.question.trim() !== '' || r.answer.trim() !== '').length
