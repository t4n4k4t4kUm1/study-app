// クイックメモ：どの画面でも右下に「メモ」ボタンを出し、押すと横（スマホでは下）からメモ帳が出てくる。
// 学習中の画面を離れずに、思いついたことをすぐ書ける。中身は掃きだめメモと同じ1枚のメモ。
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { href } from '../lib/router'
import type { ScratchNoteRepository } from '../lib/scratchNoteRepository'
import { NotesPage } from '../pages/NotesPage'
import { softSpring } from './motion'

// 画面がスマホ幅か（CSS の @media と同じ 560px で分ける）。スマホでは下から、パソコンでは右から出す
const NARROW = '(max-width: 560px)'
function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia?.(NARROW)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
const isNarrow = () => window.matchMedia?.(NARROW).matches ?? false

export function QuickMemo({ notes }: { notes: ScratchNoteRepository }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow)
  const hiddenAt = narrow ? { y: '100%' } : { x: '100%' }

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

      {/* AnimatePresence：閉じたあとも、すべって出ていく動きが終わるまで画面に残してから外す */}
      <AnimatePresence>
        {open && (
          // 閉じると NotesPage が画面から外れ、そのとき未保存の分がその場で保存される
          <motion.aside
            className="quick-memo"
            aria-label="クイックメモ"
            initial={{ ...hiddenAt, opacity: 0.6 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ ...hiddenAt, opacity: 0.6, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={softSpring}
          >
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
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
