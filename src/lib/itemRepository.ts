// データの保存先とのやり取りをまとめる層（リポジトリ）。
// 画面はこのインターフェースだけを使うので、テストではメモリ上の実装に差し替えられる。
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { Item, NewItem } from './items'

export interface ItemRepository {
  list(): Promise<Item[]>
  add(item: NewItem): Promise<Item>
}

/** 同じ科目に同じ用語がすでにあるとき */
export class DuplicateItemError extends Error {
  constructor() {
    super('この科目にはすでに同じ用語が登録されています')
    this.name = 'DuplicateItemError'
  }
}

// PostgreSQL のエラーコード: 一意制約違反
const UNIQUE_VIOLATION = '23505'

export function createSupabaseItemRepository(client: SupabaseClient<Database>): ItemRepository {
  return {
    async list() {
      const { data, error } = await client
        .from('items')
        .select('id, term, note, subject, source, created_at')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw new Error(`一覧を読み込めませんでした: ${error.message}`)
      return data
    },

    async add(item) {
      const { data, error } = await client
        .from('items')
        .insert(item)
        .select('id, term, note, subject, source, created_at')
        .single()
      if (error) {
        if (error.code === UNIQUE_VIOLATION) throw new DuplicateItemError()
        throw new Error(`保存できませんでした: ${error.message}`)
      }
      return data
    },
  }
}

/** テスト用：メモリ上に保存する実装。DB と同じく「科目＋用語」の重複を拒否する */
export function createMemoryItemRepository(initial: Item[] = []): ItemRepository {
  const items = [...initial]
  let seq = 0
  return {
    async list() {
      return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
    async add(item) {
      if (items.some((i) => i.subject === item.subject && i.term === item.term)) {
        throw new DuplicateItemError()
      }
      seq += 1
      const saved: Item = {
        ...item,
        id: `mem-${seq}`,
        created_at: new Date(Date.now() + seq).toISOString(),
      }
      items.push(saved)
      return saved
    },
  }
}
