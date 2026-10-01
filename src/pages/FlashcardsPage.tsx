// カードで学ぶ（めくって覚える）。クリックかキーボードで操作する。
import { useEffect, useReducer } from 'react'
import { deckReducer, initDeck, isFinished, range, shuffle } from '../lib/deck'
import { href } from '../lib/router'
import type { StudySet } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'
import { useStudySet } from '../lib/useStudySet'
import { LoadStatus } from './LoadStatus'

export function FlashcardsPage({ repository, id }: { repository: StudySetRepository; id: string }) {
  const state = useStudySet(repository, id)
  if (state.status !== 'ready') return <LoadStatus state={state} />
  return <FlashcardDeck set={state.set} />
}

function FlashcardDeck({ set }: { set: StudySet }) {
  const total = set.cards.length
  // useReducer：状態の変え方を deckReducer（src/lib/deck.ts）に任せる
  const [deck, dispatch] = useReducer(deckReducer, total, initDeck)
  const finished = isFinished(deck)
  const shuffleAndStart = () => dispatch({ type: 'shuffle', order: shuffle(range(total)) })

  // キーボード操作：Space / ↑ / ↓ でめくる、→ 次へ、← 前へ
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      // チェックボックスなどの入力欄を操作中は、その操作を優先する
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      const action = { ' ': 'flip', ArrowUp: 'flip', ArrowDown: 'flip', ArrowRight: 'next', ArrowLeft: 'prev' } as const
      const type = action[e.key as keyof typeof action]
      if (!type) return
      e.preventDefault() // Space でページがスクロールしたり、選択中のボタンが押されたりしないように
      dispatch({ type })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const backLink = (
    <a href={href({ name: 'set', id: set.id })} className="crumb-link">
      ← {set.title}
    </a>
  )

  if (total === 0) {
    return (
      <section className="notice">
        <nav className="crumb">{backLink}</nav>
        <p>このセットにはカードがありません。</p>
      </section>
    )
  }

  if (finished) {
    return (
      <section className="deck">
        <nav className="crumb">{backLink}</nav>
        <div className="deck-finished" role="status">
          <h1>全{total}枚をめくりました</h1>
          <div className="deck-finished-actions">
            <button type="button" className="button primary" onClick={() => dispatch({ type: 'restart' })}>
              もう一度
            </button>
            <button type="button" className="button" onClick={shuffleAndStart}>
              シャッフルしてもう一度
            </button>
            <a className="button" href={href({ name: 'set', id: set.id })}>
              セットに戻る
            </a>
          </div>
        </div>
      </section>
    )
  }

  const card = set.cards[deck.order[deck.index]]
  const question = { label: '問題', text: card.question }
  const answer = { label: '答え', text: card.answer }
  const [front, back] = deck.answerFirst ? [answer, question] : [question, answer]

  return (
    <section className="deck">
      <nav className="crumb">{backLink}</nav>

      <div className="deck-progress">
        <span aria-live="polite">
          {deck.index + 1} / {total}
        </span>
        <div className="progress-bar" aria-hidden="true">
          <div style={{ width: `${((deck.index + 1) / total) * 100}%` }} />
        </div>
      </div>

      <button
        type="button"
        className={`flashcard${deck.flipped ? ' flipped' : ''}`}
        onClick={() => dispatch({ type: 'flip' })}
      >
        <span className="flashcard-inner">
          {/* 両面を重ねて置き、回転で見せる面を切り替える。見えていない面は読み上げ対象から外す */}
          <span className="face front" aria-hidden={deck.flipped}>
            <span className="face-label">{front.label}</span>
            <span className="face-text">{front.text}</span>
          </span>
          <span className="face back" aria-hidden={!deck.flipped}>
            <span className="face-label">{back.label}</span>
            <span className="face-text">{back.text}</span>
          </span>
        </span>
      </button>

      <div className="deck-controls">
        <button type="button" className="button" onClick={() => dispatch({ type: 'prev' })} disabled={deck.index === 0}>
          ← 前へ
        </button>
        <button type="button" className="button" onClick={() => dispatch({ type: 'flip' })}>
          めくる
        </button>
        <button type="button" className="button primary" onClick={() => dispatch({ type: 'next' })}>
          次へ →
        </button>
      </div>

      <div className="deck-options">
        <label className="check">
          <input type="checkbox" checked={deck.answerFirst} onChange={() => dispatch({ type: 'toggleAnswerFirst' })} />
          答えを先に出す
        </label>
        <button type="button" className="link-button" onClick={shuffleAndStart}>
          シャッフル
        </button>
        <button type="button" className="link-button" onClick={() => dispatch({ type: 'restart' })}>
          最初から
        </button>
      </div>
      <p className="hint">キーボード：Space めくる ／ → 次へ ／ ← 前へ</p>
    </section>
  )
}
