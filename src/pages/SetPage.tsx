// 1つの学習セットの中身。ここから学習の形式を選んだり、編集・削除したりする。
import { useState } from 'react'
import { href } from '../lib/router'
import type { StudySet } from '../lib/studySet'
import type { StudySetRepository } from '../lib/studySetRepository'
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
      <div className="modes">
        <a className="mode" href={href({ name: 'cards', id: set.id })}>
          <span className="mode-name">カード</span>
          <span className="mode-desc">めくって覚える</span>
        </a>
      </div>

      <h2>カード一覧</h2>
      <ol className="card-list" aria-label="カード一覧">
        {set.cards.map((c) => (
          <li key={c.id}>
            <span className="q">{c.question}</span>
            <span className="a">{c.answer}</span>
          </li>
        ))}
      </ol>

      <DeleteSet set={set} repository={repository} />
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

  if (!confirming) {
    return (
      <div className="danger-zone">
        <button type="button" className="link-button danger" onClick={() => setConfirming(true)}>
          このセットを削除
        </button>
      </div>
    )
  }

  return (
    <div className="danger-zone confirm" role="group" aria-label="削除の確認">
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
    </div>
  )
}
