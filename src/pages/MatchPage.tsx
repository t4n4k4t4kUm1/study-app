// マッチで学ぶ画面。「はじめる前の設定」→「盤で組み合わせを選ぶ」→「結果」の流れ。設定と結果は入力・4択と共通の部品を使う。
// 机にカードを2列に並べるイメージ：左に問題、右に答え（ばらばら）。左を選んでから、右の合う札を選ぶ。
// ルール（何を記録するか、次の盤へどう進むか）は src/lib/match.ts にあり、この画面は見た目と操作だけを受け持つ。
import { motion } from 'motion/react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { shake, softSpring, spring } from '../components/motion'
import { StudyResult, StudyStart } from '../components/StudyParts'
import { correctTextOf } from '../lib/choice'
import { range, shuffle } from '../lib/deck'
import {
  buildBoard,
  currentBoard,
  isLastBoard,
  MATCH_BOARD_SIZE,
  matchAvailability,
  matchReducer,
  planRetry,
  roundProgress,
  startMatch,
  type MatchMode,
} from '../lib/match'
import { href } from '../lib/router'
import type { StudySet } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'
import { MODE_LABELS } from '../lib/studySession'
import { useSessionSaver, type StudySettings } from '../lib/useSessionSaver'
import { useStudySet } from '../lib/useStudySet'
import { LoadStatus } from './LoadStatus'

/** 右の列の札に付ける文字（キーボードの a〜f） */
const RIGHT_KEYS = 'abcdefghij'

export function MatchPage({ repository, id }: { repository: StudySetRepository; id: string }) {
  const state = useStudySet(repository, id)
  const [settings, setSettings] = useState<StudySettings | null>(null)
  const [runCount, setRunCount] = useState(0) // 「もう一度」のたびに増やし、盤を作り直す
  if (state.status !== 'ready') return <LoadStatus state={state} />
  const { set } = state

  // URL を直接開かれたときのために、ここでも枚数を確かめる（セットの画面では札が暗くなっている）
  const availability = matchAvailability(set.cards.length)
  if (!availability.ok) {
    return (
      <section className="notice">
        <nav className="crumb">
          <a href={href({ name: 'set', id: set.id })}>← {set.title}</a>
        </nav>
        <p>{availability.reason}</p>
      </section>
    )
  }

  if (!settings) {
    return (
      <StudyStart
        set={set}
        title="マッチで学ぶ"
        lead={`${set.cards.length}組。左の問題を選んでから、右の合う答えを選びます（1つの盤は最大${MATCH_BOARD_SIZE}組）。`}
        modes={MODES}
        modeDescriptions={MODE_DESCRIPTIONS}
        reverseLabel="逆向き（答えを見て、問題を選ぶ）"
        onStart={setSettings}
      />
    )
  }
  return (
    <MatchRun
      key={runCount}
      set={set}
      settings={settings}
      repository={repository}
      onAgain={() => setRunCount((n) => n + 1)}
      onChangeSettings={() => setSettings(null)}
    />
  )
}

const MODES: readonly MatchMode[] = ['normal', 'test']
const MODE_DESCRIPTIONS: Record<MatchMode, string> = {
  normal: '最初に外した組は、最後にもう一度出ます。全部そろうまで続きます（点数は1周目）',
  test: '1周だけ。外した組は、結果の画面で見直せます',
}

/** 選んだ結果を一瞬だけ見せるための印（n を増やすと、同じ札でもアニメーションがもう一度動く） */
type Flash = { kind: 'correct' | 'wrong'; left: string; right: string; n: number }

function MatchRun({
  set,
  settings,
  repository,
  onAgain,
  onChangeSettings,
}: {
  set: StudySet
  settings: StudySettings
  repository: StudySetRepository
  onAgain: () => void
  onChangeSettings: () => void
}) {
  const cardsById = useMemo(() => new Map(set.cards.map((c) => [c.id, c])), [set])
  const allIds = useMemo(() => set.cards.map((c) => c.id), [set])
  const [state, dispatch] = useReducer(matchReducer, undefined, () => {
    const order = settings.shuffle ? shuffle(range(allIds.length)).map((i) => allIds[i]) : allIds
    return startMatch(settings.mode as MatchMode, order)
  })
  const { saveState, save } = useSessionSaver({ repository, set, method: 'match', settings, state })
  const [flash, setFlash] = useState<Flash | null>(null)

  // かかった時間：はじめた時刻から、終わるまで（画面に出すだけで、記録には保存しない）
  const startedAt = useRef(Date.now())
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  useEffect(() => {
    if (state.phase === 'finished' && elapsedMs === null) setElapsedMs(Date.now() - startedAt.current)
  }, [state.phase, elapsedMs])

  // 盤の札は、盤が変わったときだけ作る（右の並びが、選ぶたびに変わらないように）
  const boardIds = currentBoard(state)
  const board = useMemo(
    () => buildBoard(cardsById, boardIds, settings.direction),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 盤（何周目の何番目か）が変わったときだけ作り直す
    [state.round, state.boardIndex, cardsById, settings.direction],
  )

  function select(cardId: string) {
    setFlash(null)
    dispatch({ type: 'select', cardId })
  }

  function pick(tileCardId: string) {
    const selected = state.selected
    const card = selected ? cardsById.get(selected) : undefined
    const tile = cardsById.get(tileCardId)
    if (!selected || !card || !tile || state.usedTiles.includes(tileCardId)) return
    const given = correctTextOf(tile, settings.direction)
    // 文字が同じなら正解（同じ答えのカードが何枚かあっても、どの札でもよい）
    const correct = given === correctTextOf(card, settings.direction)
    setFlash((f) => ({ kind: correct ? 'correct' : 'wrong', left: selected, right: tileCardId, n: (f?.n ?? 0) + 1 }))
    dispatch({ type: 'pick', tileCardId, given, correct, answeredAt: new Date().toISOString() })
  }

  function next() {
    setFlash(null)
    const nextRound =
      isLastBoard(state) && state.mode === 'normal' && state.wrong.length > 0
        ? planRetry(state.wrong, allIds)
        : undefined
    dispatch({ type: 'next', nextRound })
  }

  // キーボード：左の札は 1〜6、右の札は a〜f（そろった盤では Enter で「次へ」。ボタンに最初から合わせてある）
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || state.phase !== 'playing') return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= board.left.length) {
        e.preventDefault()
        select(board.left[n - 1].cardId)
        return
      }
      const r = RIGHT_KEYS.indexOf(e.key.toLowerCase())
      if (e.key.length === 1 && r >= 0 && r < board.right.length) {
        e.preventDefault()
        pick(board.right[r].cardId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (state.phase === 'finished') {
    return (
      <StudyResult
        set={set}
        settings={settings}
        state={state}
        saveState={saveState}
        onRetrySave={save}
        onAgain={onAgain}
        onChangeSettings={onChangeSettings}
        emptyAnswerLabel="（なし）"
        elapsedMs={elapsedMs ?? undefined}
      />
    )
  }

  const progress = roundProgress(state)
  const reverse = settings.direction === 'reverse'

  return (
    <section className="typing match">
      <nav className="crumb">
        <a href={href({ name: 'set', id: set.id })}>← {set.title}（やめる）</a>
      </nav>
      <div className="deck-progress">
        <span aria-live="polite">
          {state.round > 1 && <span className="round">{state.round}周目（外した組）・</span>}盤 {state.boardIndex + 1} /{' '}
          {state.boards.length}・{MODE_LABELS[settings.mode]}モード
        </span>
        <div className="progress-bar" aria-hidden="true">
          <motion.div
            initial={false}
            animate={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            transition={spring}
          />
        </div>
      </div>

      {/* 盤が変わるたびに作り直され、右からすべり込む */}
      <motion.div
        key={`${state.round}-${state.boardIndex}`}
        className="match-board"
        initial={{ opacity: 0, x: 48 }}
        animate={{ opacity: 1, x: 0 }}
        transition={softSpring}
      >
        <div className="match-col">
          <p className="match-col-title">{reverse ? '答え' : '問題'}</p>
          <ol aria-label={reverse ? '答え（左の列）' : '問題（左の列）'}>
            {board.left.map((t, i) => {
              const matched = state.matched.includes(t.cardId)
              const selected = state.selected === t.cardId
              const wrong = flash?.kind === 'wrong' && flash.left === t.cardId
              return (
                <li key={t.cardId}>
                  <motion.button
                    key={wrong ? `w${flash.n}` : 'idle'}
                    type="button"
                    className={`choice match-tile${selected ? ' is-selected' : ''}${matched ? ' is-matched' : ''}${wrong ? ' is-wrong' : ''}`}
                    onClick={() => select(t.cardId)}
                    disabled={matched}
                    aria-pressed={selected}
                    animate={wrong ? shake : matched ? { opacity: 0.4, scale: 0.97 } : { opacity: 1, scale: 1 }}
                    transition={wrong ? undefined : spring}
                  >
                    <span className="choice-key" aria-hidden="true">
                      {matched ? '✓' : i + 1}
                    </span>
                    <span className="choice-text">{t.text}</span>
                  </motion.button>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="match-col">
          <p className="match-col-title">{reverse ? '問題' : '答え'}</p>
          <ol aria-label={reverse ? '問題（右の列）' : '答え（右の列）'}>
            {board.right.map((t, i) => {
              const used = state.usedTiles.includes(t.cardId)
              const wrong = flash?.kind === 'wrong' && flash.right === t.cardId
              return (
                <li key={t.cardId}>
                  <motion.button
                    key={wrong ? `w${flash.n}` : 'idle'}
                    type="button"
                    className={`choice match-tile${used ? ' is-matched' : ''}${wrong ? ' is-wrong' : ''}`}
                    onClick={() => pick(t.cardId)}
                    // 左を選ぶまでは押せない（押しても何も起きないので、薄くして分かるようにする）
                    disabled={used || state.selected === null}
                    animate={
                      wrong
                        ? shake
                        : used
                          ? { opacity: 0.4, scale: 0.97 }
                          : { opacity: state.selected === null ? 0.7 : 1, scale: 1 }
                    }
                    transition={wrong ? undefined : spring}
                  >
                    <span className="choice-key" aria-hidden="true">
                      {used ? '✓' : RIGHT_KEYS[i]}
                    </span>
                    <span className="choice-text">{t.text}</span>
                  </motion.button>
                </li>
              )
            })}
          </ol>
        </div>
      </motion.div>

      {/* 選んだ結果を、画面読み上げにも伝える */}
      <p className={`match-status ${flash?.kind ?? ''}`} aria-live="polite">
        {state.phase === 'playing' && flash?.kind === 'correct' && 'そろいました'}
        {state.phase === 'playing' && flash?.kind === 'wrong' && '違います。もう一度選んでください'}
      </p>

      {state.phase === 'cleared' && (
        <motion.div
          className="typing-feedback correct"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring}
        >
          <p className="verdict" role="alert">
            この盤はそろいました
          </p>
          <div className="typing-actions">
            <button type="button" className="button primary" onClick={next} autoFocus>
              {isLastBoard(state) && !(state.mode === 'normal' && state.wrong.length > 0)
                ? '結果を見る（Enter）'
                : '次の盤へ（Enter）'}
            </button>
          </div>
        </motion.div>
      )}
      {state.phase === 'playing' && (
        <p className="hint">
          {state.selected === null
            ? `左の札を選んでください（キーボード：1〜${board.left.length}）`
            : `合う札を右から選んでください（キーボード：a〜${RIGHT_KEYS[board.right.length - 1]}）`}
        </p>
      )}
    </section>
  )
}
