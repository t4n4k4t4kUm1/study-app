// 掃きだめメモの保存先とのやり取り（リポジトリ）。学習セットのリポジトリと同じ考え方で、テストではメモリ版に差し替える。
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { NoteConflictError, type ScratchNote } from './scratchNote'

export interface ScratchNoteRepository {
  /** 自分のメモを読む。まだ無ければ空のメモ */
  load(): Promise<ScratchNote>
  /**
   * メモを保存し、新しい更新日時を返す。
   * baseUpdatedAt：最後に読み込んだ（または保存した）ときの更新日時。DB と違えば NoteConflictError
   */
  save(body: string, baseUpdatedAt: string | null): Promise<string>
}

// PostgreSQL のエラーコード 40001：DB の関数 save_scratch_note が「衝突」に使っている
const CONFLICT = '40001'

export function createSupabaseScratchNoteRepository(client: SupabaseClient<Database>): ScratchNoteRepository {
  // 保存と読み込みの順番を守るための「列」。
  // クイックメモを閉じた直後に全画面のメモを開くと、「閉じるときの保存」が終わる前に「開くときの読み込み」が走り、
  // 古い中身を読んでしまう。読み込みは、それより前に始まった保存が終わるのを待ってから行う
  let pendingSave: Promise<unknown> = Promise.resolve()

  return {
    async load() {
      await pendingSave
      // RLS で自分の行しか見えないので、条件を付けなくても自分のメモだけが返る
      const { data, error } = await client.from('scratch_notes').select('body, updated_at').maybeSingle()
      if (error) throw new Error(`メモを読み込めませんでした: ${error.message}`)
      return data ? { body: data.body, updatedAt: data.updated_at } : { body: '', updatedAt: null }
    },

    save(body, baseUpdatedAt) {
      const saving = (async () => {
        const { data, error } = await client.rpc('save_scratch_note', {
          p_body: body,
          p_base_updated_at: baseUpdatedAt,
        })
        if (error) {
          if (error.code === CONFLICT) throw new NoteConflictError()
          throw new Error(`メモを保存できませんでした: ${error.message}`)
        }
        return data
      })()
      pendingSave = saving.catch(() => undefined) // 失敗しても、待っている読み込みは先に進める
      return saving
    },
  }
}

/** テスト用：メモリ上の実装。otherDevice で「ほかの端末が保存した」状態を作れる */
export function createMemoryScratchNoteRepository(initial: ScratchNote = { body: '', updatedAt: null }) {
  let current = { ...initial }
  let clock = 0
  const stamp = () => `2026-10-05T09:00:00.${String(++clock).padStart(6, '0')}+00:00`
  const repo: ScratchNoteRepository & { current: () => ScratchNote; otherDevice: (body: string) => void } = {
    async load() {
      return { ...current }
    },
    async save(body, baseUpdatedAt) {
      if (current.updatedAt !== null && baseUpdatedAt !== current.updatedAt) throw new NoteConflictError()
      current = { body, updatedAt: stamp() }
      return current.updatedAt!
    },
    current: () => ({ ...current }),
    otherDevice: (body) => {
      current = { body, updatedAt: stamp() }
    },
  }
  return repo
}
