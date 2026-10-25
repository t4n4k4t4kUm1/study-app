// test-sets/ の検証用ファイルが、「まとめて貼り付け」で思ったとおりに読めるかを確かめるテスト。
// ファイルを書き換えて壊してしまったときや、読み取りのルールを変えたときに気づけるようにする。
import { describe, expect, it } from 'vitest'
import { parseBulk } from './bulkImport'
import { buildChoices, choiceAvailability } from './choice'
import { matchAvailability } from './match'
import type { Card } from './studySet'

// Vite の機能で、フォルダの中のファイルを文字のまま読み込む
const files = import.meta.glob('../../test-sets/*.tsv', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>
const read = (name: string) => {
  const text = files[`../../test-sets/${name}`]
  if (text === undefined) throw new Error(`test-sets/${name} がありません`)
  return parseBulk(text, '\t', 'タブ')
}
const asCards = (cards: { question: string; answer: string }[]): Card[] =>
  cards.map((c, i) => ({ ...c, id: `c${i}`, position: i }))

/** 読めない行がないはずのファイルと、その枚数 */
const EXPECTED_COUNTS: Record<string, number> = {
  '01-three-cards.tsv': 3,
  '02-four-cards.tsv': 4,
  '03-korean-verbs-20.tsv': 20,
  '04-duplicate-answers.tsv': 7,
  '05-answer-variants.tsv': 10,
  '06-long-and-multiline.tsv': 9,
  '07-times-table-100.tsv': 100,
}

describe('検証用セット（test-sets/）', () => {
  it('README に書いたファイルが全部ある（90 番台はわざと壊したファイル）', () => {
    const names = Object.keys(files).map((p) => p.split('/').pop())
    expect(names.sort()).toEqual([...Object.keys(EXPECTED_COUNTS), '90-broken-lines.tsv'].sort())
  })

  it.each(Object.entries(EXPECTED_COUNTS))('%s は読めない行がなく、%i 枚として読める', (name, count) => {
    const r = read(name)
    expect(r.errors).toEqual([])
    expect(r.cards).toHaveLength(count)
  })

  it('01 は4択・マッチが使えない枚数、02 はちょうど使える枚数', () => {
    expect(choiceAvailability(read('01-three-cards.tsv').cards.length).ok).toBe(false)
    expect(choiceAvailability(read('02-four-cards.tsv').cards.length).ok).toBe(true)
    expect(matchAvailability(read('01-three-cards.tsv').cards.length).ok).toBe(false)
    expect(matchAvailability(read('02-four-cards.tsv').cards.length).ok).toBe(true)
  })

  it('04 は違う答えが3種類しかないので、選択肢は3つになる（逆向きなら4つ）', () => {
    const cards = asCards(read('04-duplicate-answers.tsv').cards)
    expect(new Set(cards.map((c) => c.answer)).size).toBe(3)
    expect(buildChoices(cards, 'c0', 'forward')).toHaveLength(3)
    expect(buildChoices(cards, 'c0', 'reverse')).toHaveLength(4)
  })

  it('06 のセル内の改行・"" ・500文字ちょうど・前後の空白が、思ったとおりに読める', () => {
    const cards = read('06-long-and-multiline.tsv').cards
    expect(cards[0].question).toBe('次の行列の固有値は？\n[ 2 1 ]\n[ 1 2 ]')
    expect(cards[1].question).toHaveLength(500)
    expect(cards[4].question).toBe('彼は "やあ" と言った')
    expect(cards[6]).toEqual({ question: '前後に空白', answer: '消える' })
    expect(cards[7].question).toBe('"to be" の意味')
  })

  it('90 はわざと壊したファイル。読めない行が、何行目か付きで出る', () => {
    const r = read('90-broken-lines.tsv')
    expect(r.cards).toEqual([
      { question: '먹다', answer: '食べる' },
      { question: '가다', answer: '行く' },
    ])
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6])
  })
})
