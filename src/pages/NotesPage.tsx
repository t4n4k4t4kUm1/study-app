// 掃きだめメモ：思いついたことを何でも書いておく、1人1枚の大きなメモ帳。
// 書くのをやめて少し経つと自動で保存する。ほかの端末で先に保存されていたら、上書きせずにどうするか聞く。
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { mergeBodies, NOTE_LIMIT, NoteConflictError } from '../lib/scratchNote'
import type { ScratchNoteRepository } from '../lib/scratchNoteRepository'
import { formatJst } from '../lib/studySession'

// loading：読み込み中 / loadError：読み込み失敗 / saved：保存済み / dirty：未保存の変更あり
// saving：保存中 / error：保存失敗 / conflict：ほかの端末で更新されていた
type Status = 'loading' | 'loadError' | 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'

export function NotesPage({
  notes,
  autosaveDelayMs = 1000, // 最後に文字を打ってから保存するまでの待ち時間（テストでは短くする）
  compact = false, // true：クイックメモ（横から出るパネル）の中で使う小さい表示
}: {
  notes: ScratchNoteRepository
  autosaveDelayMs?: number
  compact?: boolean
}) {
  const [body, setBodyState] = useState('')
  const [status, setStatusState] = useState<Status>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // 保存の処理は「打っている途中」にも走るので、最新の値を画面の描き直しを待たずに読める ref に入れておく
  const bodyRef = useRef('')
  const savedBodyRef = useRef('') // 最後に保存した（読み込んだ）中身
  const baseRef = useRef<string | null>(null) // 最後に保存した（読み込んだ）ときの更新日時
  const savingRef = useRef(false)
  const statusRef = useRef<Status>('loading')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const ready = status !== 'loading' && status !== 'loadError'

  // 読み込めたら、カーソルをいちばん最後に置き、最後の行が見えるようにする（掃きだめメモは下に書き足していくため）
  useEffect(() => {
    const el = textareaRef.current
    if (!ready || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.scrollTop = el.scrollHeight
  }, [ready])

  // 値を変えるときは、画面用（state）と処理用（ref）の両方を同時に変える
  // useCallback で包むと、毎回の描き直しで同じ関数が使い回される
  const setBody = useCallback((value: string) => {
    bodyRef.current = value
    setBodyState(value)
  }, [])
  const setStatus = useCallback((value: Status) => {
    statusRef.current = value
    setStatusState(value)
  }, [])

  const fetchNote = useCallback(() => {
    notes
      .load()
      .then((note) => {
        bodyRef.current = note.body
        savedBodyRef.current = note.body
        baseRef.current = note.updatedAt
        setBody(note.body)
        setSavedAt(note.updatedAt)
        setStatus('saved')
      })
      .catch((e: unknown) => {
        setMessage(e instanceof Error ? e.message : 'メモを読み込めませんでした')
        setStatus('loadError')
      })
  }, [notes, setBody, setStatus])

  useEffect(() => {
    fetchNote()
  }, [fetchNote])

  function reload() {
    setStatus('loading')
    fetchNote()
  }

  const saveNow = useCallback(async () => {
    if (savingRef.current) return // 保存中なら、終わったあとにもう一度自動で走る
    const text = bodyRef.current
    if (text === savedBodyRef.current) {
      setStatus('saved')
      return
    }
    savingRef.current = true
    setStatus('saving')
    try {
      const at = await notes.save(text, baseRef.current)
      baseRef.current = at
      savedBodyRef.current = text
      setSavedAt(at)
      // 保存している間にまた打っていたら「未保存」に戻す（→ もう一度自動保存される）
      setStatus(bodyRef.current === text ? 'saved' : 'dirty')
    } catch (e) {
      if (e instanceof NoteConflictError) {
        setStatus('conflict')
      } else {
        setMessage(e instanceof Error ? e.message : 'メモを保存できませんでした')
        setStatus('error')
      }
    } finally {
      savingRef.current = false
    }
  }, [notes, setStatus])

  // 自動保存：「未保存」になってから autosaveDelayMs のあいだ何も打たなければ保存する
  // （打つたびに待ち時間がリセットされるので、打っている最中には保存しない）
  useEffect(() => {
    if (status !== 'dirty') return
    const timer = setTimeout(() => void saveNow(), autosaveDelayMs)
    return () => clearTimeout(timer)
  }, [status, body, autosaveDelayMs, saveNow])

  // 未保存のままタブを閉じようとしたら、ブラウザに確認を出してもらう
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (bodyRef.current !== savedBodyRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // アプリの中でほかの画面へ移るときは、待たずにその場で保存しておく
  useEffect(
    () => () => {
      const unsaved = bodyRef.current !== savedBodyRef.current
      const s = statusRef.current
      if (unsaved && !savingRef.current && s !== 'conflict' && s !== 'loading' && s !== 'loadError') {
        notes.save(bodyRef.current, baseRef.current).catch(() => undefined)
      }
    },
    [notes],
  )

  function handleChange(value: string) {
    setBody(value)
    if (statusRef.current !== 'saving' && statusRef.current !== 'conflict') setStatus('dirty')
  }

  // Ctrl+S（Mac は ⌘+S）ですぐ保存
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault() // ブラウザの「ページを保存」を出さない
      void saveNow()
    }
  }

  // 衝突したとき：最新の内容を読み込み直してから、選んだ方法で保存する
  async function resolve(choice: 'merge' | 'overwrite') {
    try {
      const base = savedBodyRef.current // 衝突する前に、両方の端末が持っていた共通の中身
      const latest = await notes.load()
      baseRef.current = latest.updatedAt
      savedBodyRef.current = latest.body
      if (choice === 'merge') {
        setBody(mergeBodies(base, latest.body, bodyRef.current))
      }
      setStatus('dirty')
      await saveNow()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'メモを読み込めませんでした')
      setStatus('error')
    }
  }

  if (status === 'loading') return <p className="muted">読み込み中…</p>
  if (status === 'loadError')
    return (
      <section className="notice">
        <p className="error" role="alert">
          {message}
        </p>
        <button type="button" className="button" onClick={reload}>
          もう一度読み込む
        </button>
      </section>
    )

  return (
    <section className={`notes${compact ? ' compact' : ''}`}>
      {compact ? (
        <SaveStatus status={status} savedAt={savedAt} />
      ) : (
        <>
          <div className="page-head">
            <h1>掃きだめメモ</h1>
            <SaveStatus status={status} savedAt={savedAt} />
          </div>
          <p className="muted">
            思いついたことを何でも、乱雑に。書くのをやめると自動で保存されます（Ctrl+S
            ですぐ保存）。右下の「メモ」から、どの画面でも開けます。
          </p>
        </>
      )}

      {status === 'conflict' && (
        <div className="conflict" role="alert">
          <p>
            <strong>ほかの端末でこのメモが更新されていました。</strong>
            この端末の変更はまだ保存していません。どうしますか？
          </p>
          <div className="danger-actions">
            <button type="button" className="button primary" onClick={() => void resolve('merge')}>
              両方残す
            </button>
            <button type="button" className="button" onClick={() => void resolve('overwrite')}>
              この端末の内容で上書きする
            </button>
          </div>
          <p className="hint">
            「両方残す」：どちらの端末も後ろに書き足しただけなら、両方の追記をつなげます。途中を書き換えていた場合は、この端末の内容を区切り線の下に丸ごと足します。
          </p>
        </div>
      )}
      {status === 'error' && (
        <p className="error" role="alert">
          {message}{' '}
          <button type="button" className="link-button" onClick={() => void saveNow()}>
            もう一度保存する
          </button>
        </p>
      )}

      <textarea
        className="notes-body"
        aria-label="掃きだめメモ"
        value={body}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={NOTE_LIMIT}
        placeholder={'例：\n・固有値は det(A − λI) = 0 の解\n・먹다 → 먹어요（です・ます形）\n・レポートの締切は金曜'}
        ref={textareaRef}
      />
      <p className="hint notes-count">
        {body.length.toLocaleString()} / {NOTE_LIMIT.toLocaleString()} 文字
      </p>
    </section>
  )
}

function SaveStatus({ status, savedAt }: { status: Status; savedAt: string | null }) {
  const text =
    status === 'saving'
      ? '保存中…'
      : status === 'dirty'
        ? '未保存の変更があります'
        : status === 'conflict' || status === 'error'
          ? '保存できていません'
          : savedAt
            ? `保存しました（${formatJst(savedAt)}）`
            : 'まだ何も書いていません'
  return (
    <span className={`save-badge is-${status}`} role="status">
      {text}
    </span>
  )
}
