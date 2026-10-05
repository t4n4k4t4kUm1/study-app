// 学習セットの入力フォーム。「作る」画面と「編集」画面の両方で使う共通の部品。
// タイトル・説明と、問題・答えの組（カード）を何枚でも入力でき、ドラッグか ↑↓ ボタンで並べ替えられる。
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { moveItem, shouldMove } from '../lib/reorder'
import { LIMITS, parseSetDraft, type CardDraft, type NewStudySet } from '../lib/studySet'

// key：React が行を見分けるための番号。行を消したり並べ替えたりしても入力内容がずれないように、
// 何番目か（添字）ではなく、行ごとに固有の番号を使う
type Row = CardDraft & { key: number }

// ドラッグで運ぶデータの種類。text/plain にすると、入力欄の上で離したときに文字として貼り付けられてしまう
const DRAG_TYPE = 'application/x-study-card-row'

type Props = {
  heading: string
  backLink: { href: string; label: string }
  initial: { title: string; description: string; cards: CardDraft[] }
  submitLabel: string
  /** 保存する。失敗したら Error を投げる（メッセージがそのまま画面に出る） */
  onSubmit: (value: NewStudySet) => Promise<void>
}

export function SetEditor({ heading, backLink, initial, submitLabel, onSubmit }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [rows, setRows] = useState<Row[]>(() => initial.cards.map((c, key) => ({ ...c, key })))
  const [error, setError] = useState<{ message: string; cardIndex?: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [draggingKey, setDraggingKey] = useState<number | null>(null) // 見た目（半透明）用

  const nextKey = useRef(initial.cards.length)
  const formRef = useRef<HTMLFormElement>(null)
  const rowRefs = useRef(new Map<number, HTMLLIElement>())
  const questionRefs = useRef(new Map<number, HTMLTextAreaElement>())
  const focusKeyAfterRender = useRef<number | null>(null)
  // ドラッグ中の行。ドラッグの合図は短い間に何十回も来るので、画面の描き直しを待たずに読める ref にも入れておく
  const draggingRef = useRef<number | null>(null)

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

  function updateRow(key: number, field: 'question' | 'answer', value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev))
    setError(null)
  }

  function moveRow(from: number, to: number) {
    setRows((prev) => moveItem(prev, from, to))
    setError(null) // エラーの行番号がずれるので消す
  }

  // ---- ドラッグ＆ドロップ（ブラウザ標準の仕組みを使う） ----
  function handleDragStart(e: DragEvent, key: number) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(DRAG_TYPE, String(key))
    const li = rowRefs.current.get(key)
    if (li) e.dataTransfer.setDragImage(li, 24, 24) // つまみだけでなく、行全体が動いて見えるように
    draggingRef.current = key
    setDraggingKey(key)
    setError(null) // エラーの行番号がずれるので消す
  }

  function endDrag() {
    draggingRef.current = null
    setDraggingKey(null)
  }

  function handleDragOver(e: DragEvent<HTMLLIElement>, targetIndex: number) {
    const key = draggingRef.current
    if (key === null) return // 行以外（文字など）のドラッグは相手にしない
    e.preventDefault() // これを呼ぶと「ここに落としてよい」という合図になる
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const pointerY = e.clientY
    // 最新の並び（prev）を使って計算する。合図が続けて来ても、古い並びで計算しないように
    setRows((prev) => {
      const from = prev.findIndex((r) => r.key === key)
      return shouldMove(from, targetIndex, pointerY, rect.top, rect.height) ? moveItem(prev, from, targetIndex) : prev
    })
  }

  function handleDrop(e: DragEvent) {
    if (draggingRef.current === null) return
    e.preventDefault() // 並べ替えはドラッグ中に済んでいるので、落としたときは何もしない
    endDrag()
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
      await onSubmit(parsed.value) // 成功すると呼び出し側が別の画面へ移る
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : '保存に失敗しました' })
      setSaving(false)
    }
  }

  const filledCount = rows.filter((r) => r.question.trim() !== '' && r.answer.trim() !== '').length

  return (
    <form ref={formRef} className="set-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
      <nav className="crumb">
        <a href={backLink.href}>{backLink.label}</a>
      </nav>
      <h1>{heading}</h1>

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
          const n = i + 1
          const invalid = error?.cardIndex === i
          const isLast = i === rows.length - 1
          return (
            <li
              key={row.key}
              ref={(el) => {
                if (el) rowRefs.current.set(row.key, el)
                else rowRefs.current.delete(row.key)
              }}
              className={`card-row${invalid ? ' invalid' : ''}${draggingKey === row.key ? ' dragging' : ''}`}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={handleDrop}
            >
              <div className="card-row-head">
                {/* つまみ：ここをつかんでドラッグする。キーボードや画面読み上げでは ↑↓ ボタンを使う */}
                <span
                  className="drag-handle"
                  draggable
                  onDragStart={(e) => handleDragStart(e, row.key)}
                  onDragEnd={endDrag}
                  title="ドラッグして並べ替え"
                  aria-hidden="true"
                >
                  ⠿
                </span>
                <span className="card-no">{n}</span>
              </div>
              <label className="field">
                問題
                <textarea
                  ref={(el) => {
                    if (el) questionRefs.current.set(row.key, el)
                    else questionRefs.current.delete(row.key)
                  }}
                  aria-label={`${n}枚目の問題`}
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
                  aria-label={`${n}枚目の答え`}
                  aria-invalid={invalid || undefined}
                  value={row.answer}
                  onChange={(e) => updateRow(row.key, 'answer', e.target.value)}
                  onKeyDown={(e) => handleAnswerKeyDown(e, isLast)}
                  rows={1}
                  maxLength={LIMITS.answer}
                />
              </label>
              <div className="row-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => moveRow(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`${n}枚目を上へ`}
                  title="上へ"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => moveRow(i, i + 1)}
                  disabled={isLast}
                  aria-label={`${n}枚目を下へ`}
                  title="下へ"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-button remove"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  aria-label={`${n}枚目を削除`}
                  title="このカードを削除"
                >
                  ×
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <button type="button" className="button add-row" onClick={addRow}>
        ＋ カードを追加
      </button>
      <p className="hint">
        ⠿ をつかんでドラッグするか、↑↓ で並べ替えられます。最後のカードの「答え」で Tab
        を押すと次のカードが増えます。Ctrl+Enter で保存。
      </p>

      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
