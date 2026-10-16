// 「入力」と「4択」で共通の部品：はじめる前の設定、出題中の上の部分、結果の画面（記録の保存は src/lib/useSessionSaver.ts）。
// どちらも「問題を1つずつ出し、間違えたらもう一度」という同じ流れ（src/lib/typing.ts）で進むので、前後の画面も同じにしている。
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { href } from '../lib/router'
import type { StudySet } from '../lib/studySet'
import { MODE_LABELS, percent } from '../lib/studySession'
import { firstRoundMistakes, firstRoundScore, type TypingMode, type TypingState } from '../lib/typing'
import type { SaveState, StudySettings } from '../lib/useSessionSaver'
import { itemVariants, listVariants, softSpring, spring } from './motion'

// ---------------- はじめる前の設定 ----------------

export function StudyStart({
  set,
  title,
  lead,
  modeDescriptions,
  reverseLabel,
  hint,
  onStart,
}: {
  set: StudySet
  title: string
  lead: string
  modeDescriptions: Record<TypingMode, string>
  reverseLabel: string
  hint?: string
  onStart: (s: StudySettings) => void
}) {
  const [mode, setMode] = useState<TypingMode>('normal')
  const [reverse, setReverse] = useState(false)
  const [shuffled, setShuffled] = useState(true)

  return (
    <section className="typing">
      <nav className="crumb">
        <a href={href({ name: 'set', id: set.id })}>← {set.title}</a>
      </nav>
      <h1>{title}</h1>
      <p className="muted">{lead}</p>

      <fieldset className="panel mode-choice">
        <legend>モード</legend>
        {(['normal', 'test', 'thorough'] as const).map((m) => (
          <label key={m} className={`mode-option${mode === m ? ' selected' : ''}`}>
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
            <span>
              <span className="mode-option-name">{MODE_LABELS[m]}モード</span>
              <span className="mode-option-desc">{modeDescriptions[m]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="typing-options">
        <label className="check">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
          {reverseLabel}
        </label>
        <label className="check">
          <input type="checkbox" checked={shuffled} onChange={(e) => setShuffled(e.target.checked)} />
          順番をシャッフル
        </label>
      </div>
      {hint && <p className="hint">{hint}</p>}

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

// ---------------- 結果 ----------------

export function StudyResult({
  set,
  settings,
  state,
  saveState,
  onRetrySave,
  onAgain,
  onChangeSettings,
  emptyAnswerLabel,
}: {
  set: StudySet
  settings: StudySettings
  state: TypingState
  saveState: SaveState
  onRetrySave: () => void
  onAgain: () => void
  onChangeSettings: () => void
  emptyAnswerLabel: string // 空の答えをどう見せるか（入力：「（わからない）」）
}) {
  const score = firstRoundScore(state)
  const mistakes = firstRoundMistakes(state)
  const reverse = settings.direction === 'reverse'
  const cardsById = new Map(set.cards.map((c) => [c.id, c]))

  return (
    <section className="typing">
      <nav className="crumb">
        <a href={href({ name: 'set', id: set.id })}>← {set.title}</a>
      </nav>
      <motion.div
        className="typing-result panel"
        role="status"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={softSpring}
      >
        <h1>おつかれさまでした</h1>
        <p className="score">
          <span className="score-label">1周目の正解</span>
          <motion.span
            className="score-value"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring, delay: 0.15 }}
          >
            {score.correct} / {score.total}
          </motion.span>
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
              <button type="button" className="link-button" onClick={onRetrySave}>
                もう一度保存する
              </button>
            </>
          )}
        </p>
      </motion.div>

      {mistakes.length > 0 && (
        <>
          <h2>1周目に間違えた問題</h2>
          <motion.ol
            className="card-list mistakes"
            aria-label="間違えた問題"
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            {mistakes.map((a) => {
              const c = cardsById.get(a.cardId)
              if (!c) return null
              return (
                <motion.li key={a.cardId} variants={itemVariants}>
                  <span className="q">{reverse ? c.answer : c.question}</span>
                  <span className="a">
                    <span className="given">{a.given === '' ? emptyAnswerLabel : a.given}</span>
                    <span className="expected">→ {reverse ? c.question : c.answer}</span>
                  </span>
                </motion.li>
              )
            })}
          </motion.ol>
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

// ---------------- 出題中の上の部分（進み具合と問題のカード） ----------------

export function StudyPromptHeader({
  set,
  state,
  reverse,
  prompt,
}: {
  set: StudySet
  state: TypingState
  reverse: boolean
  prompt: ReactNode
}) {
  return (
    <>
      <nav className="crumb">
        <a href={href({ name: 'set', id: set.id })}>← {set.title}（やめる）</a>
      </nav>
      <div className="deck-progress">
        <span aria-live="polite">
          {state.round > 1 && <span className="round">{state.round}周目（間違えた問題）・</span>}
          {state.index + 1} / {state.queue.length}
        </span>
        <div className="progress-bar" aria-hidden="true">
          <motion.div
            initial={false}
            animate={{ width: `${((state.index + 1) / state.queue.length) * 100}%` }}
            transition={spring}
          />
        </div>
      </div>

      {/* 問題が変わるたびに作り直され、右からすべり込む */}
      <motion.div
        key={`${state.round}-${state.index}`}
        className="typing-card panel"
        initial={{ opacity: 0, x: 48, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={softSpring}
      >
        <span className="face-label">{reverse ? '答え' : '問題'}</span>
        <p className="typing-prompt">{prompt}</p>
      </motion.div>
    </>
  )
}
