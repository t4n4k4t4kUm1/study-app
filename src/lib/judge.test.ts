import { describe, expect, it } from 'vitest'
import { exactJudge, isExactMatch, judgeFor, lenientJudge, normalizeAnswer } from './judge'

describe('normalizeAnswer（比べるための形にそろえる）', () => {
  it.each([
    ['２０２６', '2026'], // 全角の数字
    ['Ａｐｐｌｅ', 'apple'], // 全角の英字と大文字
    ['ｱｲｽｸﾘｰﾑ', 'アイスクリーム'], // 半角カナ
    ['ice　 cream', 'ice cream'], // 全角スペースと続いた空白
    ['  赤\n黄  ', '赤 黄'], // 改行と前後の空白
    ['食べる。', '食べる'], // 文末の句点
    ['Hello!!', 'hello'],
    ['本当？', '本当'], // 全角の？は NFKC で ? になってから消える
    ['a, b.', 'a, b'], // 文の途中のカンマは残す
    ['?', '?'], // 句読点しかないときは、そのまま（「!」と「?」を同じにしない）
    ['감사합니다', '감사합니다'], // ハングルはそのまま
    ['がっこう', 'がっこう'], // ひらがなはカタカナにしない
  ])('「%s」→「%s」', (text, normalized) => {
    expect(normalizeAnswer(text)).toBe(normalized)
  })
})

describe('きびしい判定（exactJudge）', () => {
  it('前後の空白と、正解の中の改行だけは気にしない', () => {
    expect(isExactMatch('apple', ' apple ')).toBe(true)
    expect(isExactMatch('赤\n黄', '赤 黄')).toBe(true)
  })

  it('全角・大文字・空白の数・句読点の違いは不正解', () => {
    expect(exactJudge('2', '２')).toBe(false)
    expect(exactJudge('apple', 'Apple')).toBe(false)
    expect(exactJudge('ice cream', 'ice  cream')).toBe(false)
    expect(exactJudge('食べる', '食べる。')).toBe(false)
  })
})

describe('ゆるい判定（lenientJudge）', () => {
  it.each([
    ['2', '２'],
    ['apple', 'Apple'],
    ['ice cream', 'ice  cream'],
    ['アイス', 'ｱｲｽ'],
    ['食べる', '食べる。'],
    ['Hello!', 'hello'],
    ['CO', 'Co'], // 大文字・小文字を区別したい科目では「きびしい」を選ぶ
  ])('正解「%s」に「%s」は正解', (expected, given) => {
    expect(lenientJudge(expected, given)).toBe(true)
  })

  it.each([
    ['コンピューター', 'コンピュータ'], // 伸ばす音の有無は、覚えるべき違い
    ['がっこう', 'ガッコウ'], // ひらがなとカタカナ
    ['ice cream', 'icecream'], // 空白があるかないか
    ['?', '!'], // 記号だけの答え
    ['食べる', '食べた'],
  ])('正解「%s」に「%s」は不正解', (expected, given) => {
    expect(lenientJudge(expected, given)).toBe(false)
  })
})

describe('judgeFor', () => {
  it('設定に合わせて判定係を選ぶ', () => {
    expect(judgeFor('strict')).toBe(exactJudge)
    expect(judgeFor('lenient')).toBe(lenientJudge)
  })
})
