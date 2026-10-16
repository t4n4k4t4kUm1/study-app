// 4択で学ぶ画面。「はじめる前の設定」→「出題」→「結果」の流れは入力モードと同じ（共通の部品を使う）。
// 違うのは答え方だけ：4つの選択肢から選ぶ（クリックか、キーボードの 1〜4）。
import { motion } from 'motion/react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { itemVariants, listVariants, shake, spring } from '../components/motion'
import { StudyPromptHeader, StudyResult, StudyStart } from '../components/StudyParts'
import { buildAllChoices, choiceAvailability, correctTextOf } from '../lib/choice'
import { range, shuffle } from '../lib/deck'
import { href } from '../lib/router'
import type { StudySet } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'
import { currentCardId, isCorrect, lastAttempt, startTyping, typingReducer, type TypingMode } from '../lib/typing'
import { useSessionSaver, type StudySettings } from '../lib/useSessionSaver'
import { useStudySet } from '../lib/useStudySet'
import { LoadStatus } from './LoadStatus'

export function ChoicePage({ repository, id }: { repository: StudySetRepository; id: string }) {
  const state = useStudySet(repository, id)
  const [settings, setSettings] = useState<StudySettings | null>(null)
  const [runCount, setRunCount] = useState(0) // 「もう一度」のたびに増やし、出題の部品を作り直す
  if (state.status !== 'ready') return <LoadStatus state={state} />
  const { set } = state

  // URL を直接開かれたときのために、ここでも枚数を確かめる（セットの画面では札が暗くなっている）
  const availability = choiceAvailability(set.cards.length)
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
        title="4択で学ぶ"
        lead={`${set.cards.length}問。4つの選択肢から正しいものを選びます（クリックか、キーボードの 1〜4）。`}
        modeDescriptions={MODE_DESCRIPTIONS}
        reverseLabel="逆向き（答えを見て、問題を選ぶ）"
        onStart={setSettings}
      />
    )
  }
  return (
    <ChoiceRun
      key={runCount}
      set={set}
      settings={settings}
      repository={repository}
      onAgain={() => setRunCount((n) => n + 1)}
      onChangeSettings={() => setSettings(null)}
    />
  )
}

const MODE_DESCRIPTIONS: Record<TypingMode, string> = {
  normal: '間違えた問題は最後にもう一度。全部正解するまで続きます（点数は1周目）',
  test: '1周だけ。間違えたら正解を見て次へ進みます',
  thorough: '間違えたら、正解を選び直すまで次に進めません',
}

function ChoiceRun({
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
  // 選択肢は、はじめに全部のカードの分を1回だけ作る（同じ問題が2周目に出ても、同じ並びにする）
  const [choices] = useState(() => buildAllChoices(set.cards, settings.direction))
  const [state, dispatch] = useReducer(typingReducer, undefined, () => {
    const ids = set.cards.map((c) => c.id)
    return startTyping(settings.mode, settings.shuffle ? shuffle(range(ids.length)).map((i) => ids[i]) : ids)
  })
  // 徹底モードで、この問題で選んで外れた選択肢（もう選べないように暗くする）
  const [missed, setMissed] = useState<string[]>([])
  const { saveState, save } = useSessionSaver({ repository, set, method: 'choice', settings, state })
  const reverse = settings.direction === 'reverse'

  const cardId = currentCardId(state)
  const card = cardId ? cardsById.get(cardId) : undefined
  const options = cardId ? (choices.get(cardId) ?? []) : []
  const expected = card ? correctTextOf(card, settings.direction) : ''
  const last = lastAttempt(state)
  const canChoose = state.phase === 'answering' || state.phase === 'retyping'

  const nextOrder = () => (settings.shuffle ? shuffle(range(state.wrong.length)).map((i) => state.wrong[i]) : undefined)

  function choose(option: string) {
    if (state.phase === 'answering') {
      dispatch({
        type: 'submit',
        given: option,
        judgedCorrect: option === expected,
        answeredAt: new Date().toISOString(),
      })
      return
    }
    if (state.phase === 'retyping' && !missed.includes(option)) {
      // 徹底モードの選び直し：正解なら次の問題へ、外れたらその選択肢を暗くする
      const correct = option === expected
      if (correct) setMissed([])
      else setMissed((m) => [...m, option])
      dispatch({ type: 'retype', correct, nextOrder: nextOrder() })
    }
  }

  function next() {
    setMissed([])
    dispatch({ type: 'next', nextOrder: nextOrder() })
  }

  // キーボードの 1〜4 で選ぶ（答えを見ている間は Enter で「次へ」。ボタンに最初から合わせてある）
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > options.length || !canChoose) return
      e.preventDefault()
      choose(options[n - 1])
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
        emptyAnswerLabel="（未回答）"
      />
    )
  }

  if (!card) return null
  const prompt = reverse ? card.answer : card.question
  const answered = state.phase !== 'answering' && last !== undefined
  const resultCorrect = answered && isCorrect(last)

  // 選択肢ごとの見た目：正解（緑）・選んで外れた（赤）・そのほか
  function optionState(option: string): 'correct' | 'wrong' | 'idle' {
    if (!answered) return 'idle'
    if (option === expected) return 'correct'
    if (option === last.given || missed.includes(option)) return 'wrong'
    return 'idle'
  }

  return (
    <section className="typing">
      <StudyPromptHeader set={set} state={state} reverse={reverse} prompt={prompt} />

      {/* 選択肢：問題が変わるたびに、上から順番に出てくる */}
      <motion.ol
        key={`${state.round}-${state.index}`}
        className="choices"
        aria-label="選択肢"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        {options.map((option, i) => {
          const look = optionState(option)
          const locked = !canChoose || (state.phase === 'retyping' && (look === 'wrong' || missed.includes(option)))
          return (
            <motion.li key={option} variants={itemVariants}>
              <motion.button
                type="button"
                className={`choice is-${look}`}
                onClick={() => choose(option)}
                disabled={locked}
                animate={look === 'wrong' ? shake : look === 'correct' ? { scale: [1, 1.04, 1] } : undefined}
                transition={look === 'correct' ? spring : undefined}
              >
                <span className="choice-key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="choice-text">{option}</span>
              </motion.button>
            </motion.li>
          )
        })}
      </motion.ol>

      {state.phase === 'retyping' && (
        <p className="verdict-line incorrect" role="alert">
          不正解。緑の正解を選び直してください
        </p>
      )}

      {state.phase === 'feedback' && last && (
        <motion.div
          key={`${state.attempts.length}`}
          className={`typing-feedback ${resultCorrect ? 'correct' : 'incorrect'}`}
          initial={resultCorrect ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={spring}
        >
          <p className="verdict" role="alert">
            {resultCorrect ? '正解！' : '不正解'}
          </p>
          <div className="typing-actions">
            <button type="button" className="button primary" onClick={next} autoFocus>
              次へ（Enter）
            </button>
          </div>
        </motion.div>
      )}
      {canChoose && <p className="hint">キーボード：1〜{options.length} で選ぶ</p>}
    </section>
  )
}
