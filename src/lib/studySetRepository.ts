// データの保存先とのやり取りをまとめる層（リポジトリ）。
// 画面はこのインターフェースだけを使うので、テストではメモリ上の実装に差し替えられる。
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { NewStudySet, StudySet, StudySetSummary } from './studySet'

export interface StudySetRepository {
  /** 学習セットの一覧（新しい順） */
  listSets(): Promise<StudySetSummary[]>
  /** 1つの学習セットとカード全部。見つからなければ null */
  getSet(id: string): Promise<StudySet | null>
  /** 学習セットをカードごと作り、新しいセットの id を返す */
  createSet(set: NewStudySet): Promise<string>
  /** 学習セットを書き換える。カードは並び順どおりに全部渡す（id なし＝追加、渡さなかったもの＝削除） */
  updateSet(id: string, set: NewStudySet): Promise<void>
  /** 学習セットをカードごと削除する */
  deleteSet(id: string): Promise<void>
}

export function createSupabaseStudySetRepository(client: SupabaseClient<Database>): StudySetRepository {
  return {
    async listSets() {
      // cards(count) で、各セットのカード枚数を一緒に取る（カードの中身は取らない）
      const { data, error } = await client
        .from('study_sets')
        .select('id, title, description, created_at, cards(count)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(`一覧を読み込めませんでした: ${error.message}`)
      return data.map(({ cards, ...set }) => ({ ...set, card_count: cards[0]?.count ?? 0 }))
    },

    async getSet(id) {
      const { data, error } = await client
        .from('study_sets')
        .select('id, title, description, created_at, cards(id, position, question, answer)')
        .eq('id', id)
        .order('position', { referencedTable: 'cards' })
        .maybeSingle()
      if (error) throw new Error(`学習セットを読み込めませんでした: ${error.message}`)
      return data
    },

    async createSet(set) {
      // DB の関数 create_study_set を呼ぶ。セットとカードが1回の処理でまとめて保存される
      const { data, error } = await client.rpc('create_study_set', {
        p_title: set.title,
        p_description: set.description,
        p_cards: set.cards,
      })
      if (error) throw new Error(`保存できませんでした: ${error.message}`)
      return data
    },

    async updateSet(id, set) {
      // DB の関数 update_study_set を呼ぶ。セットとカードの書き換えが1回の処理でまとめて行われる
      const { error } = await client.rpc('update_study_set', {
        p_id: id,
        p_title: set.title,
        p_description: set.description,
        p_cards: set.cards,
      })
      if (error) throw new Error(`保存できませんでした: ${error.message}`)
    },

    async deleteSet(id) {
      // カードは DB の「on delete cascade」でセットと一緒に消える
      // select('id') で消えた行を返してもらい、0行なら（他人のセットなどで）消せなかったと分かる
      const { data, error } = await client.from('study_sets').delete().eq('id', id).select('id')
      if (error) throw new Error(`削除できませんでした: ${error.message}`)
      if (data.length === 0) throw new Error('削除できませんでした: 学習セットが見つかりません')
    },
  }
}

/** テスト用：メモリ上に保存する実装 */
export function createMemoryStudySetRepository(initial: StudySet[] = []): StudySetRepository {
  const sets = initial.map((s) => ({ ...s, cards: [...s.cards] }))
  let seq = 0
  return {
    async listSets() {
      return [...sets]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(({ cards, ...s }) => ({ ...s, card_count: cards.length }))
    },
    async getSet(id) {
      return sets.find((s) => s.id === id) ?? null
    },
    async createSet(set) {
      seq += 1
      const id = crypto.randomUUID()
      sets.push({
        id,
        title: set.title,
        description: set.description,
        created_at: new Date(Date.now() + seq).toISOString(),
        cards: set.cards.map((c, i) => ({ ...c, id: crypto.randomUUID(), position: i })),
      })
      return id
    },
    async updateSet(id, set) {
      const target = sets.find((s) => s.id === id)
      if (!target) throw new Error('保存できませんでした: 学習セットが見つかりません')
      if (set.cards.some((c) => c.id && !target.cards.some((old) => old.id === c.id)))
        throw new Error('保存できませんでした: このセットにないカードが含まれています')
      target.title = set.title
      target.description = set.description
      target.cards = set.cards.map((c, i) => ({
        id: c.id ?? crypto.randomUUID(),
        position: i,
        question: c.question,
        answer: c.answer,
      }))
    },
    async deleteSet(id) {
      const index = sets.findIndex((s) => s.id === id)
      if (index === -1) throw new Error('削除できませんでした: 学習セットが見つかりません')
      sets.splice(index, 1)
    },
  }
}
