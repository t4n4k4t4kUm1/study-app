// ブラックジャックの勝負とのやり取り（リポジトリ）。テストではメモリ版に差し替える。
// Supabase 版は DB の関数を呼ぶだけ。山札・伏せカード・勝ち負けは DB の中にあり、画面には「見てよい形」しか届かない。
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  betError,
  canDouble,
  double,
  hit,
  shuffledShoe,
  stand,
  startRound,
  viewOf,
  type BlackjackView,
  type Card,
  type Round,
} from './blackjack'
import type { MemoryCreditRepository } from './creditRepository'
import type { Database } from './database.types'

export interface BlackjackRepository {
  /** 途中の勝負（ページを開き直したときの続き）。無ければ null */
  current(): Promise<BlackjackView | null>
  /** 賭けて始める。賭け金はこの時点で残高から引かれる */
  start(bet: number): Promise<BlackjackView>
  hit(roundId: string): Promise<BlackjackView>
  stand(roundId: string): Promise<BlackjackView>
  double(roundId: string): Promise<BlackjackView>
}

export function createSupabaseBlackjackRepository(client: SupabaseClient<Database>): BlackjackRepository {
  // DB の関数のエラー文（「クレジットが足りません」など）はそのまま画面に出せる日本語にしてある
  const fail = (message: string) => new Error(message || '通信に失敗しました')
  return {
    async current() {
      const { data, error } = await client.rpc('blackjack_state')
      if (error) throw fail(error.message)
      return (data as BlackjackView | null) ?? null
    },
    async start(bet) {
      const { data, error } = await client.rpc('blackjack_start', { p_bet: bet })
      if (error) throw fail(error.message)
      return data as BlackjackView
    },
    async hit(roundId) {
      const { data, error } = await client.rpc('blackjack_hit', { p_round_id: roundId })
      if (error) throw fail(error.message)
      return data as BlackjackView
    },
    async stand(roundId) {
      const { data, error } = await client.rpc('blackjack_stand', { p_round_id: roundId })
      if (error) throw fail(error.message)
      return data as BlackjackView
    },
    async double(roundId) {
      const { data, error } = await client.rpc('blackjack_double', { p_round_id: roundId })
      if (error) throw fail(error.message)
      return data as BlackjackView
    },
  }
}

/**
 * テスト用：メモリ上の実装。DB の関数と同じ決まり（blackjack.ts）で勝負を進め、クレジットの増減はメモリ版の残高に反映する。
 * decks：配る山札を順番に指定できる（指定が尽きたら、切り直した山札を使う）
 */
export function createMemoryBlackjackRepository(options: {
  credits: MemoryCreditRepository
  decks?: Card[][]
}): BlackjackRepository {
  const decks = [...(options.decks ?? [])]
  const rounds = new Map<string, Round>()
  let seq = 0

  const playing = (roundId: string) => {
    const round = rounds.get(roundId)
    if (!round || round.status !== 'playing') throw new Error('続けられる勝負が見つかりません')
    return round
  }
  // 勝負の状態を保存し、決着していたら戻ってくる額を残高に足す
  const save = (roundId: string, round: Round) => {
    rounds.set(roundId, round)
    if (round.status === 'finished' && round.payout > 0) options.credits.add(round.payout)
    return viewOf(roundId, round)
  }

  return {
    async current() {
      for (const [id, round] of rounds) if (round.status === 'playing') return viewOf(id, round)
      return null
    },
    async start(bet) {
      if ([...rounds.values()].some((r) => r.status === 'playing')) throw new Error('終わっていない勝負があります')
      const error = betError(bet, await options.credits.getBalance())
      if (error) throw new Error(error)
      seq += 1
      const id = `round-${seq}`
      options.credits.add(-bet)
      return save(id, startRound(bet, decks.shift() ?? shuffledShoe()))
    },
    async hit(roundId) {
      return save(roundId, hit(playing(roundId)))
    },
    async stand(roundId) {
      return save(roundId, stand(playing(roundId)))
    },
    async double(roundId) {
      const round = playing(roundId)
      if (!canDouble(round)) throw new Error('ダブルダウンは最初の2枚のときだけできます')
      if ((await options.credits.getBalance()) < round.bet) throw new Error('クレジットが足りません')
      options.credits.add(-round.bet)
      return save(roundId, double(round))
    },
  }
}
