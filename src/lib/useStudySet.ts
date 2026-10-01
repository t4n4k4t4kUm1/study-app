// 1つの学習セットを読み込むフック。「セットの中身」画面と「カードで学ぶ」画面で共通に使う。
import { useEffect, useState } from 'react'
import type { StudySet } from './studySet'
import type { StudySetRepository } from './studySetRepository'

export type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'notFound' }
  | { status: 'ready'; set: StudySet }

export function useStudySet(repository: StudySetRepository, id: string): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    // 読み込み中に画面を離れたら、結果を捨てる（離れた画面の状態を書き換えない）
    let cancelled = false
    repository
      .getSet(id)
      .then((set) => {
        if (!cancelled) setState(set ? { status: 'ready', set } : { status: 'notFound' })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: e instanceof Error ? e.message : '読み込みに失敗しました' })
      })
    return () => {
      cancelled = true
    }
  }, [repository, id])

  return state
}
