import { describe, expect, it } from 'vitest'
import {
  addChip,
  betError,
  canDouble,
  double,
  handValue,
  hit,
  netOf,
  rankLabel,
  shuffledShoe,
  stand,
  startRound,
  suitLabel,
  viewOf,
  type Card,
} from './blackjack'

/** テスト用のカード。c(1) = ♠A、c(13, 1) = ♥K */
const c = (rank: number, suit = 0): Card => suit * 13 + rank - 1
/** 山札を、配る順（プレイヤー・ディーラー・プレイヤー・ディーラー・そのあと引く順）に並べる */
const deck = (...ranks: number[]) => ranks.map((r) => c(r))

describe('カード', () => {
  it('番号から数字とマークが分かる。6デッキ分の番号でも同じ', () => {
    expect([rankLabel(c(1)), suitLabel(c(1))]).toEqual(['A', '♠'])
    expect([rankLabel(c(13, 1)), suitLabel(c(13, 1))]).toEqual(['K', '♥'])
    expect(rankLabel(c(10, 3) + 52 * 5)).toBe('10')
  })
})

describe('handValue', () => {
  it('J・Q・K は 10', () => {
    expect(handValue([c(11), c(12)])).toEqual({ total: 20, soft: false })
  })
  it('A は 21 を超えないなら 11（ソフト）、超えるなら 1', () => {
    expect(handValue([c(1), c(6)])).toEqual({ total: 17, soft: true })
    expect(handValue([c(1), c(6), c(10)])).toEqual({ total: 17, soft: false })
    expect(handValue([c(1), c(1)])).toEqual({ total: 12, soft: true })
    expect(handValue([c(1), c(1), c(1), c(8)])).toEqual({ total: 21, soft: true })
  })
})

describe('勝負', () => {
  it('ブラックジャックは 3:2。100 賭けたら 250 戻る（+150）', () => {
    const r = startRound(100, deck(1, 9, 13, 7))
    expect(r).toMatchObject({ status: 'finished', outcome: 'blackjack', payout: 250 })
    expect(netOf(r)).toBe(150)
  })

  it('両方ブラックジャックなら引き分けで、賭け金が戻る', () => {
    expect(startRound(100, deck(1, 1, 13, 10))).toMatchObject({ outcome: 'push', payout: 100 })
  })

  it('ディーラーだけブラックジャックなら、その場で負け（ヒットさせない）', () => {
    expect(startRound(100, deck(10, 1, 9, 13))).toMatchObject({ status: 'finished', outcome: 'lose', payout: 0 })
  })

  it('ヒットして 21 を超えたら負け。ディーラーは引かない', () => {
    let r = startRound(100, deck(10, 10, 6, 6, 9, 5))
    r = hit(r)
    expect(r).toMatchObject({ status: 'finished', outcome: 'lose', payout: 0 })
    expect(r.dealer).toHaveLength(2)
  })

  it('スタンドすると、ディーラーは 17 以上になるまで引く', () => {
    // プレイヤー 10+9=19、ディーラー 10+6=16 → 5 を引いて 21 → 負け
    const r = stand(startRound(100, deck(10, 10, 9, 6, 5)))
    expect(r.dealer.map((x) => rankLabel(x))).toEqual(['10', '6', '5'])
    expect(r).toMatchObject({ outcome: 'lose' })
  })

  it('ディーラーはソフト17（A と 6）で止まる', () => {
    const r = stand(startRound(100, deck(10, 1, 8, 6, 5)))
    expect(r.dealer).toHaveLength(2)
    expect(r).toMatchObject({ outcome: 'win', payout: 200 }) // 18 対 17
  })

  it('ディーラーが 21 を超えたら勝ち', () => {
    expect(stand(startRound(100, deck(10, 10, 2, 6, 10)))).toMatchObject({ outcome: 'win', payout: 200 })
  })

  it('同じ点数なら引き分け', () => {
    expect(stand(startRound(100, deck(10, 10, 8, 8)))).toMatchObject({ outcome: 'push', payout: 100 })
  })

  it('ヒットでちょうど 21 になったら自動で止まる', () => {
    const r = hit(startRound(100, deck(10, 10, 5, 7, 6, 9)))
    expect(r.status).toBe('finished')
    expect(r.dealer.map((x) => rankLabel(x))).toEqual(['10', '7']) // ディーラーは 17 で止まった
    expect(r).toMatchObject({ outcome: 'win' })
  })

  it('ダブルダウン：賭けが2倍になり、1枚だけ引いて止まる', () => {
    // 6+5=11 → 10 を引いて 21。ディーラー 10+7=17
    const r = double(startRound(100, deck(6, 10, 5, 7, 10)))
    expect(r.player).toHaveLength(3)
    expect(r).toMatchObject({ doubled: true, status: 'finished', outcome: 'win', payout: 400 })
    expect(netOf(r)).toBe(200)
  })

  it('ダブルダウンで負けると、2倍失う', () => {
    const r = double(startRound(100, deck(6, 10, 5, 9, 2)))
    expect(r).toMatchObject({ outcome: 'lose', payout: 0 })
    expect(netOf(r)).toBe(-200)
  })

  it('ダブルダウンは最初の2枚のときだけ', () => {
    const r = hit(startRound(100, deck(2, 10, 3, 7, 4)))
    expect(canDouble(r)).toBe(false)
    expect(() => double(r)).toThrow()
  })

  it('終わった勝負は操作できない', () => {
    const r = stand(startRound(100, deck(10, 10, 8, 8)))
    expect(() => hit(r)).toThrow()
    expect(() => stand(r)).toThrow()
  })
})

describe('viewOf', () => {
  it('勝負の途中は、ディーラーの2枚目と山札を見せない', () => {
    const r = startRound(100, deck(10, 9, 6, 13, 5))
    const v = viewOf('r1', r)
    expect(v.dealer).toEqual([c(9), null])
    expect(v).not.toHaveProperty('deck')
    expect(viewOf('r1', stand(r)).dealer).toEqual([c(9), c(13)])
  })
})

describe('賭け金', () => {
  it('100 以上・100 単位・残高以内', () => {
    expect(betError(500, 1000)).toBeNull()
    expect(betError(0, 1000)).not.toBeNull()
    expect(betError(150, 1000)).not.toBeNull()
    expect(betError(1100, 1000)).toBe('クレジットが足りません')
  })
  it('チップは所持金を超えて積めない', () => {
    expect(addChip(500, 500, 1200)).toBe(1000)
    expect(addChip(1000, 500, 1200)).toBe(1000)
  })
})

describe('shuffledShoe', () => {
  it('6デッキ＝312枚で、各カードが6枚ずつ', () => {
    const shoe = shuffledShoe()
    expect(shoe).toHaveLength(312)
    const counts = new Map<number, number>()
    for (const card of shoe) counts.set(card, (counts.get(card) ?? 0) + 1)
    expect(counts.size).toBe(52)
    expect([...counts.values()].every((n) => n === 6)).toBe(true)
  })
})
