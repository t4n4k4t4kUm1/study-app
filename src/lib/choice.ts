// 4択モードの決まり。選択肢の作り方と、4択が使えるかどうかの判断。
// 出題の進み方（通常・テスト・徹底、間違えた問題をもう一度）は、入力モードのルールブック typing.ts をそのまま使う。
import { shuffle } from './deck'
import type { Card } from './studySet'
import type { Direction } from './studySession'

export const CHOICE_COUNT = 4
/** 4択が使える最小のカード枚数（正解1つ＋ほかのカードから3つ） */
export const MIN_CARDS_FOR_CHOICE = 4

/** 4択が使えるか。使えないときは、その理由（吹き出しに出す文） */
export function choiceAvailability(cardCount: number): { ok: true } | { ok: false; reason: string } {
  if (cardCount >= MIN_CARDS_FOR_CHOICE) return { ok: true }
  return {
    ok: false,
    reason: `4択は、カードが${MIN_CARDS_FOR_CHOICE}枚以上あるセットで使えます（いまは${cardCount}枚）`,
  }
}

/** そのカードで「正しい選択肢」になる文。forward なら答え、reverse（逆向き）なら問題 */
export const correctTextOf = (card: Card, direction: Direction) =>
  direction === 'reverse' ? card.question : card.answer

/**
 * 1枚のカードの選択肢を作る。正解1つと、ほかのカードの答えから選んだ最大3つを、混ぜて並べる。
 * 同じ答えのカードが多いと、違う答えが4つそろわないことがある。そのときは、そろった数（2〜3択）にする。
 * random：0 以上 1 未満を返す関数（テストでは決まった数を返すものに替えられる）
 */
export function buildChoices(
  cards: Card[],
  cardId: string,
  direction: Direction,
  random: () => number = Math.random,
): string[] {
  const card = cards.find((c) => c.id === cardId)
  if (!card) return []
  const correct = correctTextOf(card, direction)
  // ほかのカードの文のうち、正解と同じものと、重複を除いたもの（同じ文が2つ並ぶと選べないため）
  const others = [...new Set(cards.filter((c) => c.id !== cardId).map((c) => correctTextOf(c, direction)))].filter(
    (text) => text !== correct,
  )
  const picked = shuffle(others, random).slice(0, CHOICE_COUNT - 1)
  return shuffle([correct, ...picked], random)
}

/** 全部のカードの選択肢を、はじめに1回だけ作る（問題を出すたびに並びが変わらないように） */
export function buildAllChoices(cards: Card[], direction: Direction, random: () => number = Math.random) {
  return new Map(cards.map((c) => [c.id, buildChoices(cards, c.id, direction, random)]))
}
