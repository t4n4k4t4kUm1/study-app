// キーボードで答えて学ぶ画面。「はじめる前の設定」→「出題」→「結果」の3つの場面がある。
import { motion } from 'motion/react'
import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import { shake, spring } from '../components/motion'
import { StudyPromptHeader, StudyResult, StudyStart } from '../components/StudyParts'
import { range, shuffle } from '../lib/deck'
import { exactJudge, type Judge } from '../lib/judge'
import type { StudySet } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'
import { currentCardId, lastAttempt, isCorrect, startTyping, typingReducer, type TypingMode } from '../lib/typing'
import { useSessionSaver, type StudySettings } from '../lib/useSessionSaver'
import { useStudySet } from '../lib/useStudySet'
import { LoadStatus } from './LoadStatus'

type Settings = StudySettings

export function TypingPage({
  repository,
  id,
  judge = exactJudge,
}: {
  repository: StudySetRepository
  id: string
  judge?: Judge // 判定係。将来ここを差し替えれば、ゆるい判定や AI の判定にできる
}) {
  const state = useStudySet(repository, id)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [runCount, setRunCount] = useState(0) // 「もう一度」のたびに増やし、出題の部品を作り直す
  if (state.status !== 'ready') return <LoadStatus state={state} />
  const { set } = state

  if (!settings) return <TypingStart set={set} onStart={setSettings} />
  return (
    <TypingRun
      key={runCount}
      set={set}
      settings={settings}
      judge={judge}
      repository={repository}
      onAgain={() => setRunCount((n) => n + 1)}
      onChangeSettings={() => setSettings(null)}
    />
  )
}

// ---------------- はじめる前の設定 ----------------

const MODE_DESCRIPTIONS: Record<TypingMode, string> = {
  normal: '間違えた問題は最後にもう一度。全部正解するまで続きます（点数は1周目）',
  test: '1周だけ。間違えたら正解を見て次へ進みます',
  thorough: '間違えたら、正しい答えを打ち直すまで次に進めません',
}

function TypingStart({ set, onStart }: { set: StudySet; onStart: (s: Settings) => void }) {
  return (
    <StudyStart
      set={set}
      title="入力で学ぶ"
      lead={`${set.cards.length}問。答えをキーボードで打って、Enter で答え合わせします。`}
      modeDescriptions={MODE_DESCRIPTIONS}
      reverseLabel="逆向き（答えを見て、問題を打つ）"
      hint="判定は完全一致です（前後の空白だけは無視）。打ち間違いなどは「正解にする」で直せます。"
      onStart={onStart}
    />
  )
}

// ---------------- 出題と結果 ----------------

function TypingRun({
  set,
  settings,
  judge,
  repository,
  onAgain,
  onChangeSettings,
}: {
  set: StudySet
  settings: Settings
  judge: Judge
  repository: StudySetRepository
  onAgain: () => void
  onChangeSettings: () => void
}) {
  const cardsById = useMemo(() => new Map(set.cards.map((c) => [c.id, c])), [set])
  const [state, dispatch] = useReducer(typingReducer, undefined, () => {
    const ids = set.cards.map((c) => c.id)
    return startTyping(settings.mode, settings.shuffle ? shuffle(range(ids.length)).map((i) => ids[i]) : ids)
  })
  const [input, setInput] = useState('')
  const [checking, setChecking] = useState(false)
  const { saveState, save } = useSessionSaver({ repository, set, method: 'typing', settings, state })
  const inputRef = useRef<HTMLInputElement>(null)
  const reverse = settings.direction === 'reverse'

  // 問題が変わったら、入力欄を空にしてカーソルを置く
  useEffect(() => {
    if (state.phase === 'answering' || state.phase === 'retyping') inputRef.current?.focus()
  }, [state.phase, state.index, state.round])

  const nextOrder = () => (settings.shuffle ? shuffle(range(state.wrong.length)).map((i) => state.wrong[i]) : undefined)

  const cardId = currentCardId(state)
  const card = cardId ? cardsById.get(cardId) : undefined
  const prompt = card ? (reverse ? card.answer : card.question) : ''
  const expected = card ? (reverse ? card.question : card.answer) : ''

  async function submitAnswer() {
    if (checking || !card) return
    setChecking(true)
    const given = input.trim()
    const judgedCorrect = given !== '' && (await judge(expected, given))
    dispatch({ type: 'submit', given, judgedCorrect, answeredAt: new Date().toISOString() })
    setInput('')
    setChecking(false)
  }

  async function submitRetype() {
    if (checking || !card) return
    setChecking(true)
    const correct = await judge(expected, input)
    dispatch({ type: 'retype', correct, nextOrder: nextOrder() })
    if (correct) setInput('')
    setChecking(false)
  }

  // Enter で答える。ただし日本語入力（IME）で変換を確定するための Enter では答えない
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return // 変換中の Enter（Safari は keyCode 229 で判断する）
    e.preventDefault() // 次の画面のボタンに Enter が届いて、勝手に押されないように
    if (state.phase === 'retyping') void submitRetype()
    else void submitAnswer()
  }

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
        emptyAnswerLabel="（わからない）"
      />
    )
  }

  if (!card) return null
  const last = lastAttempt(state)
  const showingResult = state.phase === 'feedback' && last !== undefined
  const resultCorrect = last !== undefined && isCorrect(last)

  return (
    <section className="typing">
      <StudyPromptHeader set={set} state={state} reverse={reverse} prompt={prompt} />

      {state.phase === 'answering' && (
        <div className="typing-input">
          <label className="field">
            {reverse ? '問題を入力' : '答えを入力'}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={checking}
            />
          </label>
          <div className="typing-actions">
            <button type="button" className="button primary" onClick={() => void submitAnswer()} disabled={checking}>
              答える
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setInput('')
                dispatch({ type: 'submit', given: '', judgedCorrect: false, answeredAt: new Date().toISOString() })
              }}
              disabled={checking}
            >
              わからない
            </button>
          </div>
          <p className="hint">Enter で答える。空のまま Enter でも「わからない」になります。</p>
        </div>
      )}

      {state.phase === 'retyping' && last && (
        <motion.div
          className="typing-feedback incorrect"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, ...shake }}
        >
          <p className="verdict" role="alert">
            不正解
          </p>
          <Answers given={last.given} expected={expected} />
          <label className="field">
            正しい答えを打ち直してください
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={state.retypeMissed || undefined}
            />
          </label>
          {state.retypeMissed && (
            <motion.p className="error" initial={{ opacity: 0 }} animate={{ opacity: 1, ...shake }}>
              まだ違います。もう一度打ってください
            </motion.p>
          )}
          <div className="typing-actions">
            <button type="button" className="button primary" onClick={() => void submitRetype()}>
              確かめる
            </button>
            <button type="button" className="button" onClick={() => dispatch({ type: 'override' })}>
              正解にする
            </button>
          </div>
        </motion.div>
      )}

      {showingResult && (
        // 正解：ぽんと弾んで光る ／ 不正解：横にぶるっと震える
        <motion.div
          key={`${state.attempts.length}-${resultCorrect}`}
          className={`typing-feedback ${resultCorrect ? 'correct' : 'incorrect'}`}
          initial={resultCorrect ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: 8 }}
          animate={resultCorrect ? { opacity: 1, scale: 1, transition: spring } : { opacity: 1, y: 0, ...shake }}
        >
          <motion.p
            className="verdict"
            role="alert"
            initial={resultCorrect ? { scale: 0.6 } : false}
            animate={{ scale: 1 }}
            transition={{ ...spring, delay: 0.05 }}
          >
            {resultCorrect ? (last.overridden ? '正解にしました' : '正解！') : '不正解'}
          </motion.p>
          {!resultCorrect && <Answers given={last.given} expected={expected} />}
          {resultCorrect && last.overridden && <Answers given={last.given} expected={expected} />}
          <div className="typing-actions">
            <button
              type="button"
              className="button primary"
              onClick={() => dispatch({ type: 'next', nextOrder: nextOrder() })}
              autoFocus
            >
              次へ（Enter）
            </button>
            {!resultCorrect && (
              <button type="button" className="button" onClick={() => dispatch({ type: 'override' })}>
                正解にする
              </button>
            )}
          </div>
        </motion.div>
      )}
    </section>
  )
}

function Answers({ given, expected }: { given: string; expected: string }) {
  return (
    <dl className="answers">
      <dt>あなたの答え</dt>
      <dd className="given">{given === '' ? '（わからない）' : given}</dd>
      <dt>正解</dt>
      <dd className="expected">{expected}</dd>
    </dl>
  )
}
