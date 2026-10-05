// 入力された答えが正しいかを決める「判定係」。
// 判定係はこの形（Judge）さえ守れば何に取り替えてもよいようにしてある。
// 例えば将来、「1文字違いなら正解」にする係や、AI に聞く係（時間がかかるので Promise を返す）に差し替えられる。

export type Judge = (expected: string, given: string) => boolean | Promise<boolean>

/**
 * いまの判定：完全一致。
 * ただし、前後の空白と、正解の中の改行だけは気にしない（入力欄では改行を打てないため、改行は空白1つとして扱う）。
 */
export const exactJudge: Judge = (expected, given) => {
  const answer = expected.replace(/\r?\n/g, ' ').trim()
  return answer === given.trim()
}
