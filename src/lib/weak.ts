// 「苦手」なカードを選ぶルールブック。単語帳の付箋と同じ考え方：
//   1周目で間違えたカードに付箋を貼り、次に1周目で正解したら付箋をはがす。
// つまり「その向きで、最後に1周目で答えたときに間違えた」カードが苦手。
//
// - 2周目以降の答えは数えない（直前に正解を見ているので、覚えたかどうかが分からない）
// - 「正解にする」を押した答えは正解として数える（点数と同じ）
// - ふつうの向きと逆向きは分けて考える（語学では、向きで難しさが大きく違うため）
// - 一度も答えたことのないカードは苦手に入れない（まだ分からない）
import type { Direction } from './studySession'

/** 1枚のカードの、1回の学習での1周目の結果（DB の answer_logs の round = 1 の行） */
export type CardResult = {
  cardId: string
  direction: Direction
  correct: boolean // 判定係の判定か「正解にする」のどちらかで正解なら true
  answeredAt: string // ISO 8601
}

/**
 * 苦手なカードの id を、cardIds の並び順で返す。
 * cardIds：いまセットにあるカード（消したカードの古い記録は無視するため）
 */
export function weakCardIds(
  cardIds: readonly string[],
  results: readonly CardResult[],
  direction: Direction,
): string[] {
  // カードごとに「最後の結果」だけを残す。時刻が同じなら、あとに並んでいるほうを新しいとみなす
  const latest = new Map<string, { time: number; correct: boolean }>()
  for (const r of results) {
    if (r.direction !== direction) continue
    const time = Date.parse(r.answeredAt)
    const prev = latest.get(r.cardId)
    if (!prev || time >= prev.time) latest.set(r.cardId, { time, correct: r.correct })
  }
  return cardIds.filter((id) => latest.get(id)?.correct === false)
}

/** 向きごとの苦手の枚数（セットの画面に出す） */
export function weakCounts(cardIds: readonly string[], results: readonly CardResult[]): Record<Direction, number> {
  return {
    forward: weakCardIds(cardIds, results, 'forward').length,
    reverse: weakCardIds(cardIds, results, 'reverse').length,
  }
}

/**
 * 出題するカード（id）。weakIds（苦手だけ）が null なら全部のカード。
 * 苦手を選んだあとにカードが消されていても困らないように、いまセットにあるものだけに絞る
 */
export function studyIds(allIds: readonly string[], weakIds: readonly string[] | null): string[] {
  if (weakIds === null) return [...allIds]
  return allIds.filter((id) => weakIds.includes(id))
}
