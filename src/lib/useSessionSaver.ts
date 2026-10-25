// 学習が終わったら、記録を1回だけ保存する部品（フック）。「入力」「4択」「マッチ」で共通。
import { useEffect, useRef, useState } from 'react'
import type { StudySet } from './studySet'
import type { StudySetRepository } from './studySetRepository'
import type { Direction, StudyMethod } from './studySession'
import type { Attempt, TypingMode } from './typing'

/** はじめる前の設定 */
export type StudySettings = { mode: TypingMode; direction: Direction; shuffle: boolean }

export type SaveState = { status: 'saving' } | { status: 'saved' } | { status: 'error'; message: string }

/**
 * 終わったら1回だけ記録を保存する部品（フック）。失敗したときにやり直す save も返す。
 * 開発中の React は確認のために処理を2回走らせることがあるので、ref で1回に絞る
 */
export function useSessionSaver({
  repository,
  set,
  method,
  settings,
  state,
}: {
  repository: StudySetRepository
  set: StudySet
  method: StudyMethod
  settings: StudySettings
  state: { phase: string; attempts: Attempt[] } // 「終わったか」と「記録する答え」だけ見る
}) {
  const [saveState, setSaveState] = useState<SaveState>({ status: 'saving' })
  const startedAt = useRef(new Date().toISOString())
  const savedOnce = useRef(false)

  function save() {
    setSaveState({ status: 'saving' })
    repository
      .recordSession({
        setId: set.id,
        method,
        mode: settings.mode,
        direction: settings.direction,
        startedAt: startedAt.current,
        attempts: state.attempts,
      })
      .then(() => setSaveState({ status: 'saved' }))
      .catch((e: unknown) =>
        setSaveState({ status: 'error', message: e instanceof Error ? e.message : '記録を保存できませんでした' }),
      )
  }
  useEffect(() => {
    if (state.phase !== 'finished' || savedOnce.current) return
    savedOnce.current = true
    save()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 終わったときに1回だけ呼ぶ
  }, [state.phase])

  return { saveState, save }
}
