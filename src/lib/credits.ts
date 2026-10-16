// クレジット（アプリ内通貨）の決まり。
// 本当の計算は DB の関数 record_study_session の中で行う（画面から「何クレジットもらった」と送っても信じない）。
// ここには同じ計算を書いておき、テストで決まりを確かめたり、テスト用のメモリ版リポジトリで使ったりする。
import { exactJudge } from './judge'
import type { Attempt } from './typing'

/** 完全一致で正解した1問 */
export const CREDITS_PER_VERIFIED = 100
/** 「正解にする」で正解にした1問（自己申告なので半分） */
export const CREDITS_PER_SELF_JUDGED = 50

/**
 * 1周目の1問ぶん。
 *   claimedCorrect：画面で正解になったか（「正解にする」も含む）。点数に数えるかどうか
 *   verified      ：完全一致の正解だと確かめられたか。満額か半分かを決める
 */
export type CreditAnswer = { claimedCorrect: boolean; verified: boolean }

export function answerCredits(a: CreditAnswer): number {
  if (!a.claimedCorrect) return 0
  return a.verified ? CREDITS_PER_VERIFIED : CREDITS_PER_SELF_JUDGED
}

/**
 * 1回の学習でもらえるクレジット ＝ 1問ごとの合計 ×（0.5 ＋ 1周目の正答率）を四捨五入。
 * 全問正解なら1.5倍、半分正解なら1倍、正答率が低いほど減る。
 * 問題数が多いセットほど合計が大きくなるので、「内容の量」と「正答率」の両方が効く。
 */
export function sessionCredits(firstRound: CreditAnswer[]): number {
  const total = firstRound.length
  if (total === 0) return 0
  const correct = firstRound.filter((a) => a.claimedCorrect).length
  const base = firstRound.reduce((sum, a) => sum + answerCredits(a), 0)
  // base ×（0.5 ＋ correct/total）を、小数のずれが出にくい形（整数どうしの割り算1回）に直したもの
  return Math.round((base * (total + 2 * correct)) / (2 * total))
}

/**
 * 解答の記録から、1周目の CreditAnswer を作る。DB と同じ決まりで「完全一致」を確かめる。
 * expectedOf：カードの id から、そのカードの正しい答え（逆向きなら問題）を返す
 */
export function firstRoundCreditAnswers(
  attempts: Attempt[],
  expectedOf: (cardId: string) => string | undefined,
): CreditAnswer[] {
  return attempts
    .filter((a) => a.round === 1)
    .map((a) => {
      const expected = expectedOf(a.cardId)
      return {
        claimedCorrect: a.judgedCorrect || a.overridden,
        verified: a.judgedCorrect && !a.overridden && expected !== undefined && exactJudge(expected, a.given) === true,
      }
    })
}

/** 「12,340」のような3桁区切りの表示 */
export function formatCredits(n: number): string {
  return n.toLocaleString('ja-JP')
}
