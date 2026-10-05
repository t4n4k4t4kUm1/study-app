// 並べ替えの計算。画面に依存しない純粋な関数なので、テストで確かめられる。

/**
 * from 番目の要素を取り出して、to 番目に差し込んだ新しい配列を返す（元の配列は変えない）。
 * 例：moveItem(['A','B','C','D'], 0, 2) → ['B','C','A','D']
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items]
  const result = [...items]
  const [moved] = result.splice(from, 1)
  result.splice(to, 0, moved)
  return result
}

/**
 * ドラッグ中に、マウスが「相手の行」のどこにあれば入れ替えるかを決める。
 * 相手の行の真ん中を越えたときだけ入れ替える。越える前に入れ替えると、
 * 高さの違う行の上で「入れ替わる→戻る→入れ替わる…」とガタガタ揺れてしまうため。
 */
export function shouldMove(from: number, to: number, pointerY: number, targetTop: number, targetHeight: number) {
  if (from === to) return false
  const middle = targetTop + targetHeight / 2
  return from < to ? pointerY >= middle : pointerY <= middle
}
