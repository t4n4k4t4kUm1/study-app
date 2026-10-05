// 学習セットを作る画面。入力フォームは SetEditor（作る・編集で共通）を使う。
import { SetEditor } from '../components/SetEditor'
import { href } from '../lib/router'
import type { StudySetRepository } from '../lib/studySetRepository'
import { navigate } from '../lib/useHashRoute'

const EMPTY_CARDS = [
  { question: '', answer: '' },
  { question: '', answer: '' },
  { question: '', answer: '' },
]

export function NewSetPage({ repository }: { repository: StudySetRepository }) {
  return (
    <SetEditor
      heading="新しい学習セット"
      backLink={{ href: href({ name: 'home' }), label: '← 一覧へ' }}
      initial={{ title: '', description: '', cards: EMPTY_CARDS }}
      submitLabel="作成する"
      onSubmit={async (value) => {
        const id = await repository.createSet(value)
        navigate(href({ name: 'set', id }))
      }}
    />
  )
}
