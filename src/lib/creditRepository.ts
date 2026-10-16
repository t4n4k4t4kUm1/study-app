// クレジットの残高とのやり取り（リポジトリ）。テストではメモリ版に差し替える。
// クレジットを「増やす」のは学習の記録を保存したとき（StudySetRepository.recordSession）で、DB の関数がまとめて行う。
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export interface CreditRepository {
  /** 自分の残高（通帳の合計） */
  getBalance(): Promise<number>
}

export function createSupabaseCreditRepository(client: SupabaseClient<Database>): CreditRepository {
  return {
    async getBalance() {
      const { data, error } = await client.rpc('credit_balance')
      if (error) throw new Error(`クレジットを読み込めませんでした: ${error.message}`)
      return Number(data)
    },
  }
}

/** テスト用：メモリ上の実装。add でクレジットを足せる（メモリ版の学習セットリポジトリが記録の保存時に呼ぶ） */
export type MemoryCreditRepository = CreditRepository & { add: (amount: number) => void }

export function createMemoryCreditRepository(
  initial = 0,
  options: { failLoad?: boolean } = {},
): MemoryCreditRepository {
  let balance = initial
  return {
    async getBalance() {
      if (options.failLoad) throw new Error('クレジットを読み込めませんでした: テスト用の失敗')
      return balance
    },
    add(amount) {
      balance += amount
    },
  }
}
