import { describe, expect, it } from 'vitest'
import { normalizeSpaces, parseItemInput, recentSubjects, timeAgo, type Item } from './items'

const empty = { term: '', note: '', subject: '', source: '' }

describe('parseItemInput', () => {
  it('用語が空なら保存できない', () => {
    expect(parseItemInput({ ...empty, term: '   ' })).toEqual({ ok: false, error: '用語を入力してください' })
  })

  it('用語だけで保存でき、任意項目は null・科目は空文字になる', () => {
    expect(parseItemInput({ ...empty, term: '固有値' })).toEqual({
      ok: true,
      value: { term: '固有値', note: null, subject: '', source: null },
    })
  })

  it('前後と連続する空白（全角含む）を整える', () => {
    const r = parseItemInput({ term: '　二分  探索 ', subject: ' 情報科学 ', note: '', source: '  ' })
    expect(r).toEqual({ ok: true, value: { term: '二分 探索', subject: '情報科学', note: null, source: null } })
  })

  it('説明の改行は残す', () => {
    const r = parseItemInput({ ...empty, term: 'a', note: '1行目\n2行目\n' })
    expect(r.ok && r.value.note).toBe('1行目\n2行目')
  })

  it('長すぎる用語は拒否する', () => {
    const r = parseItemInput({ ...empty, term: 'あ'.repeat(201) })
    expect(r.ok).toBe(false)
  })
})

describe('normalizeSpaces', () => {
  it('タブや改行も1つの空白にする', () => {
    expect(normalizeSpaces(' a\t\nb ')).toBe('a b')
  })
})

describe('recentSubjects', () => {
  const item = (subject: string, i: number): Item => ({
    id: String(i),
    term: `t${i}`,
    note: null,
    subject,
    source: null,
    created_at: new Date(2026, 9, 1, 0, 0, i).toISOString(),
  })
  it('新しい順に重複なしで、未分類（空文字）は除く', () => {
    const items = [item('線形代数', 3), item('', 2), item('韓国語', 1), item('線形代数', 0)]
    expect(recentSubjects(items)).toEqual(['線形代数', '韓国語'])
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-01T12:00:00Z')
  it.each([
    ['2026-10-01T11:59:30Z', 'たった今'],
    ['2026-10-01T11:57:00Z', '3分前'],
    ['2026-10-01T09:00:00Z', '3時間前'],
    ['2026-09-29T12:00:00Z', '2日前'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected)
  })
})
