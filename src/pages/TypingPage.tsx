// キーボードで答えて学ぶ画面。「はじめる前の設定」→「出題」→「結果」の3つの場面がある。
import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import { range, shuffle } from '../lib/deck'
import { exactJudge, type Judge } from '../lib/judge'
import { href } from '../lib/router'
import type { StudySet } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'
import { MODE_LABELS, percent, type Direction } from '../lib/studySession'
import {
  currentCardId,
  firstRoundMistakes,
  firstRoundScore,
  lastAttempt,
  isCorrect,
  startTyping,
  typingReducer,
  type TypingMode,
} from '../lib/typing'
import { useStudySet } from '../lib/useStudySet'
import { LoadStatus } from './LoadStatus'

type Settings = { mode: TypingMode; direction: Direction; shuffle: boolean }

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
  const [mode, setMode] = useState<TypingMode>('normal')
  const [reverse, setReverse] = useState(false)
  const [shuffled, setShuffled] = useState(true)

  return (
    <section className="typing">
      <nav className="crumb">
        <a href={href({ name: 'set', id: set.id })}>← {set.title}</a>
      </nav>
      <h1>入力で学ぶ</h1>
      <p className="muted">{set.cards.length}問。答えをキーボードで打って、Enter で答え合わせします。</p>

      <fieldset className="panel mode-choice">
        <legend>モード</legend>
        {(['normal', 'test', 'thorough'] as const).map((m) => (
          <label key={m} className={`mode-option${mode === m ? ' selected' : ''}`}>
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
            <span>
              <span className="mode-option-name">{MODE_LABELS[m]}モード</span>
              <span className="mode-option-desc">{MODE_DESCRIPTIONS[m]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="typing-options">
        <label className="check">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
          逆向き（答えを見て、問題を打つ）
        </label>
        <label className="check">
          <input type="checkbox" checked={shuffled} onChange={(e) => setShuffled(e.target.checked)} />
          順番をシャッフル
        </label>
      </div>
      <p className="hint">判定は完全一致です（前後の空白だけは無視）。打ち間違いなどは「正解にする」で直せます。</p>

      <button
        type="button"
        className="button primary start-button"
        onClick={() => onStart({ mode, direction: reverse ? 'reverse' : 'forward', shuffle: shuffled })}
        autoFocus
      >
        はじめる
      </button>
    </section>
  )
}

// ---------------- 出題と結果 ----------------

type SaveState = { status: 'saving' } | { status: 'saved' } | { status: 'error'; message: string }

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
  const [saveState, setSaveState] = useState<SaveState>({ status: 'saving' })
  const startedAt = useRef(new Date().toISOString())
  const savedOnce = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const reverse = settings.direction === 'reverse'

  // 問題が変わったら、入力欄を空にしてカーソルを置く
  useEffect(() => {
    if (state.phase === 'answering' || state.phase === 'retyping') inputRef.current?.focus()
  }, [state.phase, state.index, state.round])

  // 終わったら1回だけ記録を保存する（開発中の React は確認のために処理を2回走らせることがあるので、ref で1回に絞る）
  function save() {
    setSaveState({ status: 'saving' })
    repository
      .recordSession({
        setId: set.id,
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
    const score = firstRoundScore(state)
    const mistakes = firstRoundMistakes(state)
    return (
      <section className="typing">
        <nav className="crumb">
          <a href={href({ name: 'set', id: set.id })}>← {set.title}</a>
        </nav>
        <div className="typing-result panel" role="status">
          <h1>おつかれさまでした</h1>
          <p className="score">
            <span className="score-label">1周目の正解</span>
            <span className="score-value">
              {score.correct} / {score.total}
            </span>
            <span className="score-percent">{percent(score.correct, score.total)}%</span>
          </p>
          <p className="muted">
            {MODE_LABELS[settings.mode]}モード{reverse ? '・逆向き' : ''}
            {settings.mode === 'normal' && state.round > 1 && `・全部正解するまで${state.round}周`}
          </p>
          <p className={`save-status ${saveState.status}`}>
            {saveState.status === 'saving' && '記録を保存しています…'}
            {saveState.status === 'saved' && '記録を保存しました'}
            {saveState.status === 'error' && (
              <>
                {saveState.message}{' '}
                <button type="button" className="link-button" onClick={save}>
                  もう一度保存する
                </button>
              </>
            )}
          </p>
        </div>

        {mistakes.length > 0 && (
          <>
            <h2>1周目に間違えた問題</h2>
            <ol className="card-list mistakes" aria-label="間違えた問題">
              {mistakes.map((a) => {
                const c = cardsById.get(a.cardId)
                if (!c) return null
                return (
                  <li key={a.cardId}>
                    <span className="q">{reverse ? c.answer : c.question}</span>
                    <span className="a">
                      <span className="given">{a.given === '' ? '（わからない）' : a.given}</span>
                      <span className="expected">→ {reverse ? c.question : c.answer}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </>
        )}

        <div className="deck-finished-actions">
          <button type="button" className="button primary" onClick={onAgain} autoFocus>
            もう一度
          </button>
          <button type="button" className="button" onClick={onChangeSettings}>
            設定を変える
          </button>
          <a className="button" href={href({ name: 'set', id: set.id })}>
            セットに戻る
          </a>
        </div>
      </section>
    )
  }

  if (!card) return null
  const last = lastAttempt(state)
  const showingResult = state.phase === 'feedback' && last !== undefined
  const resultCorrect = last !== undefined && isCorrect(last)

  return (
    <section className="typing">
      <nav className="crumb">
        <a href={href({ name: 'set', id: set.id })}>← {set.title}（やめる）</a>
      </nav>
      <div className="deck-progress">
        <span aria-live="polite">
          {state.round > 1 && <span className="round">{state.round}周目（間違えた問題）・</span>}
          {state.index + 1} / {state.queue.length}
        </span>
        <div className="progress-bar" aria-hidden="true">
          <div style={{ width: `${((state.index + 1) / state.queue.length) * 100}%` }} />
        </div>
      </div>

      <div className="typing-card panel">
        <span className="face-label">{reverse ? '答え' : '問題'}</span>
        <p className="typing-prompt">{prompt}</p>
      </div>

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
        <div className="typing-feedback incorrect">
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
          {state.retypeMissed && <p className="error">まだ違います。もう一度打ってください</p>}
          <div className="typing-actions">
            <button type="button" className="button primary" onClick={() => void submitRetype()}>
              確かめる
            </button>
            <button type="button" className="button" onClick={() => dispatch({ type: 'override' })}>
              正解にする
            </button>
          </div>
        </div>
      )}

      {showingResult && (
        <div className={`typing-feedback ${resultCorrect ? 'correct' : 'incorrect'}`}>
          <p className="verdict" role="alert">
            {resultCorrect ? (last.overridden ? '正解にしました' : '正解！') : '不正解'}
          </p>
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
        </div>
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
