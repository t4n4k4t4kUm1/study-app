import { useRef, useState, type FormEvent } from 'react'
import { LIMITS, type ItemInput } from '../lib/items'

type Props = {
  initialSubject: string
  subjects: string[] // 入力候補に出す科目
  onSave: (input: ItemInput) => Promise<{ ok: true } | { ok: false; error: string }>
}

/** 覚えたいことを入力するフォーム。用語だけで保存でき、詳細は折りたたむ */
export function ItemForm({ initialSubject, subjects, onSave }: Props) {
  const [term, setTerm] = useState('')
  const [subject, setSubject] = useState(initialSubject)
  const [note, setNote] = useState('')
  const [source, setSource] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const termRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    const result = await onSave({ term, subject, note, source })
    setSaving(false)
    if (result.ok) {
      // 科目は残し、次の用語をすぐ入れられるようにする
      setTerm('')
      setNote('')
      setSource('')
      termRef.current?.focus()
    } else {
      setError(result.error)
    }
  }

  return (
    <form className="item-form" onSubmit={handleSubmit} aria-label="覚えたいことを保存">
      <div className="row">
        <label className="field grow">
          <span>用語</span>
          <input
            ref={termRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="例：固有値 / 먹다 / 二分探索"
            maxLength={LIMITS.term}
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
          />
        </label>
        <label className="field subject">
          <span>科目</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="例：線形代数"
            maxLength={LIMITS.subject}
            list="subject-options"
            autoComplete="off"
          />
          <datalist id="subject-options">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      </div>

      {showDetails ? (
        <div className="details">
          <label className="field">
            <span>説明（あとで書いてもよい）</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={LIMITS.note} />
          </label>
          <label className="field">
            <span>出会った場所</span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="例：線形代数1 第3回 / YouTube"
              maxLength={LIMITS.source}
            />
          </label>
        </div>
      ) : (
        <button type="button" className="link" onClick={() => setShowDetails(true)}>
          ＋ 説明・出会った場所も書く
        </button>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary" disabled={saving || term.trim() === ''}>
        {saving ? '保存中…' : '保存'}
      </button>
    </form>
  )
}
