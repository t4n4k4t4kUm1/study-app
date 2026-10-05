// 学習セットを編集する画面。今の中身を読み込んで、作る画面と同じフォーム（SetEditor）に入れておく。
import { SetEditor } from '../components/SetEditor'
import { href } from '../lib/router'
import type { StudySetRepository } from '../lib/studySetRepository'
import { navigate } from '../lib/useHashRoute'
import { useStudySet } from '../lib/useStudySet'
import { LoadStatus } from './LoadStatus'

export function EditSetPage({ repository, id }: { repository: StudySetRepository; id: string }) {
  const state = useStudySet(repository, id)
  if (state.status !== 'ready') return <LoadStatus state={state} />
  const { set } = state
  const setHref = href({ name: 'set', id: set.id })

  return (
    <SetEditor
      heading="学習セットを編集"
      backLink={{ href: setHref, label: `← ${set.title}（保存せずに戻る）` }}
      initial={{
        title: set.title,
        description: set.description ?? '',
        // id を持たせておくと、保存したときに「同じカードの書き換え」として扱われる
        cards: set.cards.map((c) => ({ id: c.id, question: c.question, answer: c.answer })),
      }}
      submitLabel="保存する"
      onSubmit={async (value) => {
        await repository.updateSet(set.id, value)
        navigate(setHref)
      }}
    />
  )
}
