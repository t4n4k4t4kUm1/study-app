// 入力された答えが正しいかを決める「判定係」。
// 判定係はこの形（Judge）さえ守れば何に取り替えてもよいようにしてある。
// 例えば将来、「1文字違いなら正解」にする係や、AI に聞く係（時間がかかるので Promise を返す）に差し替えられる。
//
// いまの係は2人：
//   strict（きびしい）：一字一句同じかを見る（isExactMatch）
//   lenient（ゆるい） ：打ち方の違いは見逃し、中身が同じかを見る（lenientJudge）。入力モードの初期値

export type Judge = (expected: string, given: string) => boolean | Promise<boolean>

/** 判定のきびしさ。はじめる前の設定で選ぶ */
export type JudgeLevel = 'lenient' | 'strict'

/**
 * 完全一致か。ただし、前後の空白と、正解の中の改行だけは気にしない
 * （入力欄では改行を打てないため、改行は空白1つとして扱う）。
 */
export function isExactMatch(expected: string, given: string): boolean {
  return expected.replace(/\r?\n/g, ' ').trim() === given.trim()
}

// 文末の句読点（「。」「、」「.」「,」「!」「?」）。全角の ！？．， は、下の NFKC で半角になってからここで消える
const TRAILING_PUNCTUATION = /[。、.,!?]+$/

/**
 * 答えを「比べるための形」にそろえる。ゆるい判定は、正解と答えの両方をこれにかけてから比べる。
 * 1. 全角と半角をそろえる（NFKC 正規化：２→2、Ａ→A、ｱ→ア、全角スペース→半角スペース）
 * 2. 大文字を小文字にする（Apple → apple）
 * 3. 改行や続いた空白を、空白1つにする（ice  cream → ice cream）。前後の空白は消す
 * 4. 文末の句読点を消す（食べる。→ 食べる、Hello! → hello）。ただし句読点しかない答え（「?」など）はそのまま
 * ひらがなとカタカナ、伸ばす音（ー）の有無は、覚えるべき違いなのでそろえない。
 */
export function normalizeAnswer(text: string): string {
  const spaced = text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
  const stripped = spaced.replace(TRAILING_PUNCTUATION, '').trimEnd()
  return stripped === '' ? spaced : stripped
}

/** ゆるい判定：そろえてから比べる */
export const lenientJudge: Judge = (expected, given) => normalizeAnswer(expected) === normalizeAnswer(given)

/** 設定から判定係を選ぶ */
export const judgeFor = (level: JudgeLevel): Judge => (level === 'strict' ? isExactMatch : lenientJudge)
