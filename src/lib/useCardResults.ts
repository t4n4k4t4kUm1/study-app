// そのセットの「カードごとの1周目の結果」を読み込むフック。苦手の枚数を出したり、苦手だけを選んだりするのに使う。
// 画面が開くたびに読み直すので、学習を終えて戻ってくると、新しい結果が入った状態になる。
import { useEffect, useState } from 'react'
import type { StudySetRepository } from './studySetRepository'
import type { CardResult } from './weak'

export type CardResultsState =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; results: CardResult[] }

export function useCardResults(repository: StudySetRepository, setId: string): CardResultsState {
  const [state, setState] = useState<CardResultsState>({ status: 'loading' })

  useEffect(() => {
    // 読み込み中に画面を離れたら、結果を捨てる（離れた画面の状態を書き換えない）
    let cancelled = false
    repository
      .listCardResults(setId)
      .then((results) => !cancelled && setState({ status: 'ready', results }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setState({ status: 'error', message: e instanceof Error ? e.message : '記録を読み込めませんでした' }),
      )
    return () => {
      cancelled = true
    }
  }, [repository, setId])

  return state
}
