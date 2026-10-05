import { describe, expect, it } from 'vitest'
import { normalizeSpaces, parseSetDraft, timeAgo, type SetDraft } from './studySet'

const draft = (over: Partial<SetDraft> = {}): SetDraft => ({
  title: '線形代数 第3章',
  description: '',
  cards: [{ question: 'Av = λv を満たす λ', answer: '固有値' }],
  ...over,
})

describe('normalizeSpaces', () => {
  it('前後の空白を除き、全角を含む連続空白を1つにする', () => {
    expect(normalizeSpaces('　 線形代数 　第3章  ')).toBe('線形代数 第3章')
  })
})

describe('parseSetDraft', () => {
  it('正しい入力は保存できる形になる（説明が空なら null）', () => {
    const r = parseSetDraft(draft())
    expect(r).toEqual({
      ok: true,
      value: {
        title: '線形代数 第3章',
        description: null,
        cards: [{ question: 'Av = λv を満たす λ', answer: '固有値' }],
      },
    })
  })

  it('タイトルが空ならエラー', () => {
    expect(parseSetDraft(draft({ title: '   ' }))).toEqual({ ok: false, error: 'タイトルを入力してください' })
  })

  it('問題・答えの両方が空の行は無視する', () => {
    const r = parseSetDraft(
      draft({
        cards: [
          { question: '', answer: '' },
          { question: '먹다', answer: '食べる' },
          { question: '  ', answer: '\n' },
        ],
      }),
    )
    expect(r.ok && r.value.cards).toEqual([{ question: '먹다', answer: '食べる' }])
  })

  it('片方だけ空の行は、何枚目かを示してエラー', () => {
    const r = parseSetDraft(
      draft({
        cards: [
          { question: 'a', answer: 'b' },
          { question: '二分探索の計算量', answer: '  ' },
        ],
      }),
    )
    expect(r).toEqual({ ok: false, error: '2枚目の答えが空です', cardIndex: 1 })
  })

  it('問題の中の改行は残し、前後の空白だけ除く', () => {
    const r = parseSetDraft(draft({ cards: [{ question: '  次の値は？\n2 + 3  ', answer: ' 5 ' }] }))
    expect(r.ok && r.value.cards[0]).toEqual({ question: '次の値は？\n2 + 3', answer: '5' })
  })

  it('カードが1枚もなければエラー', () => {
    expect(parseSetDraft(draft({ cards: [{ question: '', answer: '' }] }))).toEqual({
      ok: false,
      error: 'カードを1枚以上入力してください',
    })
  })

  it('長すぎる答えはエラー', () => {
    const r = parseSetDraft(draft({ cards: [{ question: 'q', answer: 'あ'.repeat(501) }] }))
    expect(r).toMatchObject({ ok: false, cardIndex: 0 })
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-01T06:00:00Z')
  it.each([
    ['2026-10-01T05:59:30Z', 'たった今'],
    ['2026-10-01T05:57:00Z', '3分前'],
    ['2026-10-01T03:00:00Z', '3時間前'],
    ['2026-09-29T06:00:00Z', '2日前'],
    ['2026-09-01T06:00:00Z', '2026/9/1'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected)
  })
})

describe('parseSetDraft（編集）', () => {
  it('もともとあったカードの id は残し、新しいカードには付けない', () => {
    const r = parseSetDraft(
      draft({
        cards: [
          { id: 'c1', question: '먹다', answer: '食べる' },
          { question: '자다', answer: '寝る' },
        ],
      }),
    )
    expect(r.ok && r.value.cards).toEqual([
      { id: 'c1', question: '먹다', answer: '食べる' },
      { question: '자다', answer: '寝る' },
    ])
  })
})
