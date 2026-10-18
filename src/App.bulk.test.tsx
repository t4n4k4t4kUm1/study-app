// 「まとめて貼り付け」で、作る画面・編集画面にカードを一度に足せることを、画面の操作として確かめるテスト。
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import { createMemoryScratchNoteRepository } from './lib/scratchNoteRepository'
import type { StudySet } from './lib/studySet'
import { createMemoryStudySetRepository } from './lib/studySetRepository'

const SET_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const signedIn = () => createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })
const existing = (n = 3): StudySet => ({
  id: SET_ID,
  title: '韓国語 動詞',
  description: null,
  created_at: '2026-09-30T00:00:00Z',
  cards: Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    position: i,
    question: `問${i + 1}`,
    answer: `答${i + 1}`,
  })),
})

function renderApp(sets: StudySet[] = []) {
  const repo = createMemoryStudySetRepository(sets)
  render(<App repository={repo} auth={signedIn()} notes={createMemoryScratchNoteRepository()} />)
  return repo
}

const cardTexts = () =>
  within(screen.getByRole('list', { name: 'カード一覧' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

/** 貼り付け欄を開いて、文字を貼る（キーボードで打つのではなく、貼り付けとして入れる） */
async function openAndPaste(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(await screen.findByRole('button', { name: 'まとめて貼り付け' }))
  await user.click(screen.getByLabelText('貼り付ける内容'))
  await user.paste(text)
}

beforeEach(() => {
  window.location.hash = ''
})

describe('作る画面で、まとめて貼り付け', () => {
  it('スプレッドシートの2列（タブ区切り）を貼ると、枚数と中身の確認が出て、追加・保存できる', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/new'
    renderApp()
    await user.type(await screen.findByLabelText('タイトル'), '韓国語 動詞')
    await openAndPaste(user, '먹다\t食べる\n가다\t行く\n"보다"\t"見る\n（目で）"\n자다\t寝る\n')

    expect(screen.getByText('4枚として読めます')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '読み取りの確認' })).toHaveTextContent('먹다食べる')
    await user.click(screen.getByRole('button', { name: '4枚を追加する' }))

    // はじめからある空の3行が先に埋まり、4枚目が足される。貼り付け欄は閉じる
    expect(screen.queryByLabelText('貼り付ける内容')).not.toBeInTheDocument()
    expect(screen.getByLabelText('1枚目の問題')).toHaveValue('먹다')
    expect(screen.getByLabelText('3枚目の答え')).toHaveValue('見る\n（目で）')
    expect(screen.getByLabelText('4枚目の問題')).toHaveValue('자다')
    expect(screen.queryByLabelText('5枚目の問題')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('4枚を追加しました。まだ保存はされていません')

    await user.click(screen.getByRole('button', { name: '作成する' }))
    expect(await screen.findByRole('heading', { level: 1, name: '韓国語 動詞' })).toBeInTheDocument()
    expect(cardTexts()).toHaveLength(4)
  })

  it('読めない行があると、何行目か・理由が出て、直すまで追加できない', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/new'
    renderApp()
    await openAndPaste(user, '먹다\t食べる\n区切りなし\n가다\t\n')

    expect(screen.getByText('1枚として読めます。読めない行が2行あります')).toBeInTheDocument()
    const errors = screen.getByRole('list', { name: '読めない行' })
    expect(errors).toHaveTextContent('2行目：タブが見つかりません')
    expect(errors).toHaveTextContent('3行目：答えが空です')
    expect(screen.getByRole('button', { name: '1枚を追加する' })).toBeDisabled()

    // 貼り付け欄を直すと追加できる
    await user.clear(screen.getByLabelText('貼り付ける内容'))
    await user.paste('먹다\t食べる\n가다\t行く')
    expect(screen.queryByRole('list', { name: '読めない行' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2枚を追加する' })).toBeEnabled()
  })

  it('区切りをカンマや、自分で決めた記号に切り替えられる', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/new'
    renderApp()
    await openAndPaste(user, '光合成 - 光で栄養を作る\n呼吸 - 酸素を使う')
    expect(screen.getByText(/0枚として読めます/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'カンマ' }))
    expect(screen.getByText(/0枚として読めます/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '読めない行' })).toHaveTextContent('1行目：カンマが見つかりません')

    await user.click(screen.getByRole('radio', { name: '自分で決める' }))
    expect(screen.getByText('区切りに使う記号を入力してください')).toBeInTheDocument()
    await user.type(screen.getByLabelText('区切りに使う記号'), ' - {Enter}') // Enter で保存されてしまわない
    expect(screen.getByText('2枚として読めます')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/new')
  })

  it('貼り付け欄で Ctrl+Enter を押すと、保存ではなく「追加する」になる', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/new'
    const repo = renderApp()
    await user.type(await screen.findByLabelText('タイトル'), 'テスト')
    await openAndPaste(user, 'a\tb')
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(screen.getByLabelText('1枚目の問題')).toHaveValue('a')
    expect(await repo.listSets()).toHaveLength(0) // まだ保存されていない
    expect(screen.queryByRole('alert')).not.toBeInTheDocument() // 保存しようとしてエラーになってもいない
  })
})

describe('編集画面で、まとめて貼り付け', () => {
  it('今のカードの後ろに足され、保存するとセットに入る', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}/edit`
    renderApp([existing()])
    await openAndPaste(user, '오다\t来る\n읽다\t読む')
    await user.click(screen.getByRole('button', { name: '2枚を追加する' }))
    expect(screen.getByLabelText('1枚目の問題')).toHaveValue('問1')
    expect(screen.getByLabelText('4枚目の問題')).toHaveValue('오다')
    expect(screen.getByLabelText('5枚目の答え')).toHaveValue('読む')

    await user.click(screen.getByRole('button', { name: '保存する' }))
    expect(await screen.findByRole('heading', { level: 1, name: '韓国語 動詞' })).toBeInTheDocument()
    expect(cardTexts()).toHaveLength(5)
  })

  it('足すと上限の500枚を超えるときは、追加できない', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}/edit`
    renderApp([existing(499)])
    await openAndPaste(user, 'a\tb\nc\td')
    expect(screen.getByText('追加すると501枚になり、上限の500枚を超えます')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2枚を追加する' })).toBeDisabled()
  })
})
