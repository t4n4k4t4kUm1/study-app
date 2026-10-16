// 1つの学習セットの中身。ここから学習の形式を選んだり、編集・削除したりする。
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { itemVariants, listVariants, softSpring } from '../components/motion'
import { href } from '../lib/router'
import type { StudySet } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'
import { formatJst, MODE_LABELS, percent, type StudySessionSummary } from '../lib/studySession'
import { navigate } from '../lib/useHashRoute'
import { useStudySet } from '../lib/useStudySet'
import { LoadStatus } from './LoadStatus'

export function SetPage({ repository, id }: { repository: StudySetRepository; id: string }) {
  const state = useStudySet(repository, id)
  if (state.status !== 'ready') return <LoadStatus state={state} />
  const { set } = state

  return (
    <>
      <nav className="crumb">
        <a href={href({ name: 'home' })}>← 一覧へ</a>
      </nav>
      <div className="page-head">
        <h1>{set.title}</h1>
        <a className="button" href={href({ name: 'edit', id: set.id })}>
          編集
        </a>
      </div>
      {set.description && <p className="set-description">{set.description}</p>}
      <p className="meta">{set.cards.length}枚</p>

      <h2>学習する</h2>
      <motion.div className="modes" variants={listVariants} initial="hidden" animate="show">
        <motion.a className="mode" href={href({ name: 'cards', id: set.id })} variants={itemVariants}>
          <span className="mode-name">カード</span>
          <span className="mode-desc">めくって覚える</span>
        </motion.a>
        <motion.a className="mode" href={href({ name: 'typing', id: set.id })} variants={itemVariants}>
          <span className="mode-name">入力</span>
          <span className="mode-desc">キーボードで答える</span>
        </motion.a>
      </motion.div>

      <RecentSessions setId={set.id} repository={repository} />

      <h2>カード一覧</h2>
      <motion.ol className="card-list" aria-label="カード一覧" variants={listVariants} initial="hidden" animate="show">
        {set.cards.map((c) => (
          <motion.li key={c.id} variants={itemVariants}>
            <span className="q">{c.question}</span>
            <span className="a">{c.answer}</span>
          </motion.li>
        ))}
      </motion.ol>

      <DeleteSet set={set} repository={repository} />
    </>
  )
}

// 入力で学んだ最近の記録（新しい順に5回分）
function RecentSessions({ setId, repository }: { setId: string; repository: StudySetRepository }) {
  const [sessions, setSessions] = useState<StudySessionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    repository
      .listRecentSessions(setId, 5)
      .then((rows) => !cancelled && setSessions(rows))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '記録を読み込めませんでした'))
    return () => {
      cancelled = true
    }
  }, [setId, repository])

  if (error) return <p className="error">{error}</p>
  if (!sessions || sessions.length === 0) return null
  return (
    <>
      <h2>最近の記録</h2>
      <motion.ul
        className="session-list"
        aria-label="最近の記録"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        {sessions.map((s) => (
          <motion.li key={s.id} variants={itemVariants}>
            <span className="session-when">{formatJst(s.finished_at)}</span>
            <span className="session-mode">
              入力・{MODE_LABELS[s.mode]}
              {s.direction === 'reverse' ? '・逆向き' : ''}
            </span>
            <span className="session-score">
              {s.first_round_correct} / {s.first_round_total}（{percent(s.first_round_correct, s.first_round_total)}%）
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </>
  )
}

// 削除はやり直しがきかないので、ボタンを2回押す形にする（1回目で確認を出し、2回目で本当に消す）
function DeleteSet({ set, repository }: { set: StudySet; repository: StudySetRepository }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await repository.deleteSet(set.id)
      navigate(href({ name: 'home' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
      setDeleting(false)
    }
  }

  // 「削除」を押すと、確認の枠がふわっと開く（やめると閉じる）
  return (
    <AnimatePresence mode="wait" initial={false}>
      {confirming ? (
        <motion.div
          key="confirm"
          className="danger-zone confirm"
          role="group"
          aria-label="削除の確認"
          initial={{ opacity: 0, scale: 0.96, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: softSpring }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
        >
          <p>
            「{set.title}」とカード{set.cards.length}枚を削除します。<strong>元に戻せません。</strong>
          </p>
          <div className="danger-actions">
            <button type="button" className="button danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '削除中…' : '削除する'}
            </button>
            <button type="button" className="button" onClick={() => setConfirming(false)} disabled={deleting}>
              やめる
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="link"
          className="danger-zone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="link-button danger" onClick={() => setConfirming(true)}>
            このセットを削除
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
