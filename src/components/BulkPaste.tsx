// 「まとめて貼り付け」の入力欄。作る画面・編集画面のフォーム（SetEditor）の中に開く。
// 貼った文字を、その場で読み取って「何枚として読めるか」「読めない行はどこか」を見せ、
// 「追加する」でフォームのカードに足す（保存はフォームのいつものボタンで行う）。
import { motion } from 'motion/react'
import { useState, type KeyboardEvent } from 'react'
import { parseBulk, resolveSeparator, SEPARATOR_LABELS, type SeparatorKind } from '../lib/bulkImport'
import { LIMITS } from '../lib/studySet'
import { spring } from './motion'

/** 読めない行は、多すぎると画面が埋まるので最初のいくつかだけ見せる */
const MAX_ERRORS_SHOWN = 5
const PREVIEW_COUNT = 3

type Props = {
  /** いまフォームに入っているカードの枚数（上限を超えないかを調べる） */
  currentCount: number
  onAdd: (cards: { question: string; answer: string }[]) => void
  onClose: () => void
}

export function BulkPaste({ currentCount, onAdd, onClose }: Props) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<SeparatorKind>('tab')
  const [custom, setCustom] = useState('')

  const separator = resolveSeparator(kind, custom)
  // 文字や区切りが変わるたびに読み直す（貼った瞬間にプレビューが出る）。500行ほどなら一瞬で終わるので、毎回読み直してよい
  const result = separator.ok ? parseBulk(text, separator.separator, SEPARATOR_LABELS[kind]) : null
  const total = currentCount + (result?.cards.length ?? 0)
  const overLimit = total > LIMITS.cards
  const canAdd = result !== null && result.cards.length > 0 && result.errors.length === 0 && !overLimit

  function add() {
    if (result && canAdd) onAdd(result.cards)
  }

  // 貼り付け欄で Ctrl+Enter（Mac は ⌘+Enter）を押したら、フォームの保存ではなく「追加する」にする
  function handleTextKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.stopPropagation()
      add()
    }
  }

  return (
    <motion.section
      className="panel bulk-paste"
      aria-labelledby="bulk-paste-title"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.15 } }}
      transition={spring}
    >
      <div className="bulk-head">
        <h3 id="bulk-paste-title">まとめて貼り付け</h3>
        <button type="button" className="icon-button" onClick={onClose} aria-label="まとめて貼り付けを閉じる">
          ×
        </button>
      </div>
      <p className="hint">
        1行が1枚です。問題と答えを区切りで分けて書きます。Excel や Google スプレッドシートの2列（問題・答え）は、
        そのままコピーして貼れます（区切りはタブ）。
      </p>

      <fieldset className="bulk-separators">
        <legend>問題と答えの区切り</legend>
        {(['tab', 'comma', 'custom'] as const).map((k) => (
          <label key={k} className="check">
            <input type="radio" name="bulk-separator" value={k} checked={kind === k} onChange={() => setKind(k)} />
            {k === 'custom' ? '自分で決める' : SEPARATOR_LABELS[k]}
          </label>
        ))}
        {kind === 'custom' && (
          <input
            className="bulk-custom"
            aria-label="区切りに使う記号"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            // 入力欄で Enter を押すと、フォーム全体が保存されてしまうので止める
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            placeholder="例： - "
            maxLength={10}
            autoFocus
          />
        )}
      </fieldset>

      <label className="field">
        貼り付ける内容
        <textarea
          className="bulk-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleTextKeyDown}
          placeholder={kind === 'comma' ? '먹다,食べる\n가다,行く' : '먹다\t食べる\n가다\t行く'}
          rows={8}
          spellCheck={false}
          autoFocus
        />
      </label>

      {/* 読み取りの結果。変わるたびに画面読み上げにも伝える */}
      <div className="bulk-status" aria-live="polite">
        {!separator.ok && <p className="error">{separator.reason}</p>}
        {result && text.trim() !== '' && (
          <>
            <p className={result.cards.length > 0 ? 'info' : 'muted'}>
              {result.cards.length}枚として読めます
              {result.errors.length > 0 && `。読めない行が${result.errors.length}行あります`}
            </p>
            {result.errors.length > 0 && (
              <ul className="bulk-errors" aria-label="読めない行">
                {result.errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
                  <li key={e.line}>
                    {e.line}行目：{e.reason}
                  </li>
                ))}
                {result.errors.length > MAX_ERRORS_SHOWN && <li>ほか{result.errors.length - MAX_ERRORS_SHOWN}行</li>}
              </ul>
            )}
            {overLimit && (
              <p className="error">
                追加すると{total}枚になり、上限の{LIMITS.cards}枚を超えます
              </p>
            )}
            {result.cards.length > 0 && (
              <ol className="bulk-preview" aria-label="読み取りの確認">
                {result.cards.slice(0, PREVIEW_COUNT).map((c, i) => (
                  <li key={i}>
                    <span className="q">{c.question}</span>
                    <span className="a">{c.answer}</span>
                  </li>
                ))}
                {result.cards.length > PREVIEW_COUNT && (
                  <li className="more">ほか{result.cards.length - PREVIEW_COUNT}枚</li>
                )}
              </ol>
            )}
          </>
        )}
      </div>

      <div className="bulk-actions">
        {result && result.errors.length > 0 && <span className="hint">読めない行を直すと追加できます</span>}
        <button type="button" className="button primary" onClick={add} disabled={!canAdd}>
          {result && result.cards.length > 0 ? `${result.cards.length}枚を追加する` : '追加する'}
        </button>
      </div>
    </motion.section>
  )
}
