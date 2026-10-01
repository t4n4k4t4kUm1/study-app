// 1つの学習セットの中身。ここから学習の形式を選ぶ。
import { href } from '../lib/router'
import type { StudySetRepository } from '../lib/studySetRepository'
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
      <h1>{set.title}</h1>
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
    </>
  )
}
