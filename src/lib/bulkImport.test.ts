import { describe, expect, it } from 'vitest'
import { countNonEmptyRows, mergeIntoRows, parseBulk, resolveSeparator } from './bulkImport'

describe('resolveSeparator', () => {
  it('タブ・カンマはそのまま、自分で決める区切りは入力した記号', () => {
    expect(resolveSeparator('tab', '')).toEqual({ ok: true, separator: '\t' })
    expect(resolveSeparator('comma', 'x')).toEqual({ ok: true, separator: ',' })
    expect(resolveSeparator('custom', ' - ')).toEqual({ ok: true, separator: ' - ' })
  })

  it('自分で決める区切りが空、または改行や " を含むときは使えない', () => {
    expect(resolveSeparator('custom', '')).toMatchObject({ ok: false })
    expect(resolveSeparator('custom', '"')).toMatchObject({ ok: false })
    expect(resolveSeparator('custom', 'a\nb')).toMatchObject({ ok: false })
  })
})

describe('parseBulk', () => {
  it('1行が1枚。問題と答えはタブで分かれ、前後の空白は除く', () => {
    expect(parseBulk('먹다\t食べる\n 가다 \t 行く ', '\t')).toEqual({
      cards: [
        { question: '먹다', answer: '食べる' },
        { question: '가다', answer: '行く' },
      ],
      errors: [],
    })
  })

  it('Windows の改行（\\r\\n）と、先頭の BOM を気にしない', () => {
    expect(parseBulk('﻿a\tb\r\nc\td\r\n', '\t').cards).toEqual([
      { question: 'a', answer: 'b' },
      { question: 'c', answer: 'd' },
    ])
  })

  it('空の行は飛ばす。エラーの行番号は、貼った文字の何行目かのまま', () => {
    const r = parseBulk('\na\tb\n\n   \nc\n', '\t')
    expect(r.cards).toEqual([{ question: 'a', answer: 'b' }])
    expect(r.errors).toEqual([{ line: 5, reason: '区切りが見つかりません' }])
  })

  it('区切りがない・問題が空・答えが空の行は、理由付きでエラー', () => {
    const r = parseBulk('ただの文\n\t答えだけ\n問題だけ\t\nok\tok', '\t', 'タブ')
    expect(r.errors).toEqual([
      { line: 1, reason: 'タブが見つかりません' },
      { line: 2, reason: '問題が空です' },
      { line: 3, reason: '答えが空です' },
    ])
    expect(r.cards).toEqual([{ question: 'ok', answer: 'ok' }])
  })

  it('3列以上ある行はエラー。ただし後ろの空の列は無視する', () => {
    const r = parseBulk('a\tb\tc\nd\te\t\t\n', '\t')
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatchObject({ line: 1 })
    expect(r.errors[0].reason).toMatch(/2つ以上/)
    expect(r.cards).toEqual([{ question: 'd', answer: 'e' }])
  })

  it('"…" で囲まれたセルの中の改行と区切りは、文字として残す（"" は " 1つ）。次の行の番号もずれない', () => {
    const text = '"次の値は？\n2 + 3"\t5\n"a, b"\t"彼は ""やあ"" と言った"\nx\n'
    const r = parseBulk(text, '\t')
    expect(r.cards).toEqual([
      { question: '次の値は？\n2 + 3', answer: '5' },
      { question: 'a, b', answer: '彼は "やあ" と言った' },
    ])
    expect(r.errors).toEqual([{ line: 4, reason: '区切りが見つかりません' }])
  })

  it('カンマ区切りでも "…" で囲めば、答えにカンマを入れられる', () => {
    expect(parseBulk('りんご,"apple, ringo"', ',').cards).toEqual([{ question: 'りんご', answer: 'apple, ringo' }])
  })

  it('" で始まっても囲みになっていなければ、ふつうの文字として読む', () => {
    expect(parseBulk('"to be" の意味\tある・いる\n"閉じない\tx', '\t').cards).toEqual([
      { question: '"to be" の意味', answer: 'ある・いる' },
      { question: '"閉じない', answer: 'x' },
    ])
  })

  it('自分で決めた2文字以上の区切りも使える', () => {
    expect(parseBulk('光合成 - 光で栄養を作ること\n呼吸 - 酸素を使う', ' - ').cards).toEqual([
      { question: '光合成', answer: '光で栄養を作ること' },
      { question: '呼吸', answer: '酸素を使う' },
    ])
  })

  it('長すぎる問題・答えはエラー', () => {
    const r = parseBulk(`${'あ'.repeat(501)}\tb\na\t${'い'.repeat(500)}`, '\t')
    expect(r.errors).toEqual([{ line: 1, reason: '問題が500文字を超えています（501文字）' }])
    expect(r.cards).toHaveLength(1)
  })

  it('空の文字なら、カードもエラーもない', () => {
    expect(parseBulk('', '\t')).toEqual({ cards: [], errors: [] })
    expect(parseBulk('\n \n', '\t')).toEqual({ cards: [], errors: [] })
  })
})

describe('mergeIntoRows', () => {
  type Row = { key: number; id?: string; question: string; answer: string }
  let next = 100
  const make = (c: { question: string; answer: string }): Row => ({ key: next++, ...c })

  it('空の行を先に埋め、残りを最後に足す。中身のある行はそのまま', () => {
    next = 100
    const rows: Row[] = [
      { key: 0, question: '既存', answer: 'あり' },
      { key: 1, question: '', answer: '' },
    ]
    const cards = [
      { question: 'a', answer: '1' },
      { question: 'b', answer: '2' },
    ]
    expect(mergeIntoRows(rows, cards, make)).toEqual([
      { key: 0, question: '既存', answer: 'あり' },
      { key: 1, question: 'a', answer: '1' },
      { key: 100, question: 'b', answer: '2' },
    ])
  })

  it('空の行がカードより多ければ、余った空の行は残す', () => {
    const rows: Row[] = [
      { key: 0, question: '', answer: '' },
      { key: 1, question: ' ', answer: '' },
    ]
    expect(mergeIntoRows(rows, [{ question: 'a', answer: '1' }], make)).toEqual([
      { key: 0, question: 'a', answer: '1' },
      { key: 1, question: ' ', answer: '' },
    ])
  })

  it('中身の入った行の数を数える（片方だけでも数える）', () => {
    expect(
      countNonEmptyRows([
        { question: 'a', answer: '' },
        { question: '', answer: '' },
        { question: 'q', answer: 'a' },
      ]),
    ).toBe(2)
  })
})
