// 学習セットの一覧
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { itemVariants, listVariants } from '../components/motion'
import { href } from '../lib/router'
import { timeAgo, type StudySetSummary } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; sets: StudySetSummary[] }

export function HomePage({ repository }: { repository: StudySetRepository }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    repository
      .listSets()
      .then((sets) => !cancelled && setState({ status: 'ready', sets }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setState({ status: 'error', message: e instanceof Error ? e.message : '読み込みに失敗しました' }),
      )
    return () => {
      cancelled = true
    }
  }, [repository])

  return (
    <>
      <div className="page-head">
        <h1>学習セット</h1>
        <a className="button primary" href={href({ name: 'new' })}>
          ＋ 新しいセット
        </a>
      </div>

      {state.status === 'loading' && <p className="muted loading">読み込み中…</p>}
      {state.status === 'error' && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'ready' &&
        (state.sets.length === 0 ? (
          <motion.div className="empty" variants={itemVariants} initial="hidden" animate="show">
            <p>まだ学習セットがありません。</p>
            <p className="muted">問題と答えの組をまとめて「学習セット」を作ると、カードをめくって覚えられます。</p>
          </motion.div>
        ) : (
          // 一覧のカードが、上から少しずつ遅れて浮かび上がる
          <motion.ul
            className="set-list"
            aria-label="学習セットの一覧"
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            {state.sets.map((s) => (
              <motion.li key={s.id} variants={itemVariants}>
                <a className="set-item" href={href({ name: 'set', id: s.id })}>
                  <span className="set-title">{s.title}</span>
                  {s.description && <span className="set-description">{s.description}</span>}
                  <span className="meta">
                    {s.card_count}枚 · {timeAgo(s.created_at)}
                  </span>
                </a>
              </motion.li>
            ))}
          </motion.ul>
        ))}
    </>
  )
}
