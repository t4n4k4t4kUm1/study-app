// クイックメモ：どの画面でも右下に「メモ」ボタンを出し、押すと横（スマホでは下）からメモ帳が出てくる。
// 学習中の画面を離れずに、思いついたことをすぐ書ける。中身は掃きだめメモと同じ1枚のメモ。
import { useEffect, useRef, useState } from 'react'
import { href } from '../lib/router'
import type { ScratchNoteRepository } from '../lib/scratchNoteRepository'
import { NotesPage } from '../pages/NotesPage'

export function QuickMemo({ notes }: { notes: ScratchNoteRepository }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // 閉じたら、カーソルを「メモ」ボタンに戻す（キーボードで操作している人が迷子にならないように）
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus()
    wasOpen.current = open
  }, [open])

  // Esc で閉じる
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      {/* 閉じているときだけ見せる。消さずに隠すのは、閉じたあとにカーソルを戻す先として残しておくため */}
      <button
        ref={buttonRef}
        type="button"
        className="quick-memo-button"
        onClick={() => setOpen(true)}
        hidden={open}
        aria-label="メモを開く"
        title="メモを開く"
      >
        ✎ メモ
      </button>

      {open && (
        // 閉じると NotesPage が画面から外れ、そのとき未保存の分がその場で保存される
        <aside className="quick-memo" aria-label="クイックメモ">
          <div className="quick-memo-head">
            <span className="quick-memo-title">掃きだめメモ</span>
            <a href={href({ name: 'memo' })} onClick={() => setOpen(false)}>
              大きく開く
            </a>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="メモを閉じる">
              ×
            </button>
          </div>
          <NotesPage notes={notes} compact />
          <p className="hint esc-hint">Esc で閉じる（自動で保存されます）</p>
        </aside>
      )}
    </>
  )
}
