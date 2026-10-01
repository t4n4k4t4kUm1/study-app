// 学習セットを作る画面。タイトルと、問題・答えの組（カード）を何枚でも入力できる。
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { href } from '../lib/router'
import { LIMITS, parseSetDraft, type CardDraft } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'
import { navigate } from '../lib/useHashRoute'

// key：React が行を見分けるための番号。行を消しても他の行の入力内容がずれないように、添字ではなく固有の番号を使う
type Row = CardDraft & { key: number }

const INITIAL_ROWS = 3

export function NewSetPage({ repository }: { repository: StudySetRepository }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: INITIAL_ROWS }, (_, key) => ({ key, question: '', answer: '' })),
  )
  const [error, setError] = useState<{ message: string; cardIndex?: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const nextKey = useRef(INITIAL_ROWS)
  const formRef = useRef<HTMLFormElement>(null)
  const questionRefs = useRef(new Map<number, HTMLTextAreaElement>())
  const focusKeyAfterRender = useRef<number | null>(null)

  // 行を足したあと、その行の「問題」欄にカーソルを移す（描画が終わってからでないと要素がない）
  useEffect(() => {
    if (focusKeyAfterRender.current === null) return
    questionRefs.current.get(focusKeyAfterRender.current)?.focus()
    focusKeyAfterRender.current = null
  }, [rows])

  function addRow() {
    const key = nextKey.current++
    focusKeyAfterRender.current = key
    setRows((prev) => [...prev, { key, question: '', answer: '' }])
  }

  function updateRow(key: number, field: keyof CardDraft, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev))
    setError(null)
  }

  // 最後のカードの「答え」で Tab を押したら、新しいカードを足してそこへ進む（キーボードだけで入力を続けられる）
  function handleAnswerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, isLast: boolean) {
    if (e.key === 'Tab' && !e.shiftKey && isLast) {
      e.preventDefault()
      addRow()
    }
  }

  // Ctrl+Enter（Mac は ⌘+Enter）でどこからでも保存
  function handleFormKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const parsed = parseSetDraft({ title, description, cards: rows })
    if (!parsed.ok) {
      setError({ message: parsed.error, cardIndex: parsed.cardIndex })
      return
    }
    setSaving(true)
    setError(null)
    try {
      const id = await repository.createSet(parsed.value)
      navigate(href({ name: 'set', id }))
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : '保存に失敗しました' })
      setSaving(false)
    }
  }

  const filledCount = rows.filter((r) => r.question.trim() !== '' && r.answer.trim() !== '').length

  return (
    <form ref={formRef} className="set-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
      <nav className="crumb">
        <a href={href({ name: 'home' })}>← 一覧へ</a>
      </nav>
      <h1>新しい学習セット</h1>

      <div className="panel">
        <label className="field">
          タイトル
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：線形代数 第3章、韓国語 動詞"
            maxLength={LIMITS.title}
            autoFocus
            required
          />
        </label>
        <label className="field">
          説明（任意）
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：中間試験の範囲"
            maxLength={LIMITS.description}
          />
        </label>
      </div>

      <h2>
        カード<span className="count">{filledCount}枚</span>
      </h2>
      <ol className="card-rows">
        {rows.map((row, i) => {
          const invalid = error?.cardIndex === i
          const isLast = i === rows.length - 1
          return (
            <li key={row.key} className={`card-row${invalid ? ' invalid' : ''}`}>
              <span className="card-no">{i + 1}</span>
              <label className="field">
                問題
                <textarea
                  ref={(el) => {
                    if (el) questionRefs.current.set(row.key, el)
                    else questionRefs.current.delete(row.key)
                  }}
                  aria-label={`${i + 1}枚目の問題`}
                  aria-invalid={invalid || undefined}
                  value={row.question}
                  onChange={(e) => updateRow(row.key, 'question', e.target.value)}
                  rows={1}
                  maxLength={LIMITS.question}
                />
              </label>
              <label className="field">
                答え
                <textarea
                  aria-label={`${i + 1}枚目の答え`}
                  aria-invalid={invalid || undefined}
                  value={row.answer}
                  onChange={(e) => updateRow(row.key, 'answer', e.target.value)}
                  onKeyDown={(e) => handleAnswerKeyDown(e, isLast)}
                  rows={1}
                  maxLength={LIMITS.answer}
                />
              </label>
              <button
                type="button"
                className="icon-button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                aria-label={`${i + 1}枚目を削除`}
                title="このカードを削除"
              >
                ×
              </button>
            </li>
          )
        })}
      </ol>
      <button type="button" className="button add-row" onClick={addRow}>
        ＋ カードを追加
      </button>
      <p className="hint">最後のカードの「答え」で Tab を押すと、次のカードが増えます。Ctrl+Enter で作成。</p>

      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? '保存中…' : '作成する'}
        </button>
      </div>
    </form>
  )
}
