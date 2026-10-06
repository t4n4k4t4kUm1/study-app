// 掃きだめメモの型と、画面に依存しない小さな関数。

export const NOTE_LIMIT = 100_000 // 文字数の上限（DB の決まりと同じ）

/**
 * 保存されているメモ。
 * updatedAt は DB から来た文字列をそのまま持つ（Date に変えると 1/1000 秒より細かい部分が消え、
 * 次の保存で「最後に読み込んだときの更新日時」が DB と一致しなくなるため）。まだ一度も保存していなければ null
 */
export type ScratchNote = { body: string; updatedAt: string | null }

/** ほかの端末で先に保存されていたときのエラー */
export class NoteConflictError extends Error {
  constructor() {
    super('ほかの端末でメモが更新されています')
    this.name = 'NoteConflictError'
  }
}

/**
 * 衝突したときに「両方残す」を選んだ場合の中身を作る。
 *   base   ：衝突する前に、両方の端末が持っていた共通の中身（この端末が最後に読み込んだ／保存した中身）
 *   server ：ほかの端末が保存した、いまの中身
 *   local  ：この端末で書いていた中身
 * 両方とも base の「後ろに書き足しただけ」なら、ほかの端末の中身の後ろに、この端末で足した分をつなげる。
 * それ以外（途中を書き換えた・消した）なら、どこが同じか判断できないので、区切り線をはさんで丸ごと下に足す。
 */
export function mergeBodies(base: string, server: string, local: string, now: Date = new Date()): string {
  if (server.startsWith(base) && local.startsWith(base)) {
    return server + local.slice(base.length)
  }
  const when = now.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const top = server.replace(/\s+$/, '')
  return `${top}${top === '' ? '' : '\n\n'}---- この端末で書いていた内容（${when}） ----\n${local}`
}
