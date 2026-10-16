// 画面右上に出すクレジットの残高を読み込む部品（フック）。
// refresh を呼ぶと読み込み直す（学習を保存してクレジットが増えたときに呼ぶ）。
import { useCallback, useEffect, useState } from 'react'
import type { CreditRepository } from './creditRepository'

type Loaded = { userId: string; balance: number } | { userId: string; error: true }

export function useCreditBalance(repository: CreditRepository, userId: string | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    repository
      .getBalance()
      .then((balance) => !cancelled && setLoaded({ userId, balance }))
      .catch(() => !cancelled && setLoaded({ userId, error: true }))
    return () => {
      cancelled = true
    }
  }, [repository, userId, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  // 別の人の残高が残っていたら使わない（ログインし直したとき）。読み込み直している間は、前の数字を出したままにする
  const current = loaded && loaded.userId === userId ? loaded : null
  return {
    balance: current && 'balance' in current ? current.balance : null,
    error: current !== null && 'error' in current,
    refresh,
  }
}
