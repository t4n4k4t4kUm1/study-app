// ログインと、学習セットの編集・並べ替え・削除を、画面の操作として確かめるテスト。
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import type { StudySet } from './lib/studySet'
import { createMemoryStudySetRepository } from './lib/studySetRepository'

const SET_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const sample = (): StudySet => ({
  id: SET_ID,
  title: '韓国語 動詞',
  description: null,
  created_at: '2026-09-30T00:00:00Z',
  cards: [
    { id: 'c1', position: 0, question: '먹다', answer: '食べる' },
    { id: 'c2', position: 1, question: '가다', answer: '行く' },
    { id: 'c3', position: 2, question: '보다', answer: '見る' },
  ],
})
const signedIn = () => createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })
const cardTexts = () =>
  within(screen.getByRole('list', { name: 'カード一覧' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

beforeEach(() => {
  window.location.hash = ''
})

describe('ログイン', () => {
  it('ログインしていなければログイン画面。正しいパスワードで入ると一覧が出る', async () => {
    const user = userEvent.setup()
    const auth = createMemoryAuth({ users: { 'me@example.com': 'secret-pass' } })
    render(<App repository={createMemoryStudySetRepository()} auth={auth} />)

    await screen.findByRole('heading', { name: 'ログイン' })
    await user.type(screen.getByLabelText('メールアドレス'), 'me@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('メールアドレスかパスワードが違います')

    await user.clear(screen.getByLabelText('パスワード'))
    await user.type(screen.getByLabelText('パスワード'), 'secret-pass')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(await screen.findByRole('heading', { name: '学習セット' })).toBeInTheDocument()
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
  })

  it('アカウントを作るとそのままログインでき、ログアウトするとログイン画面に戻る', async () => {
    const user = userEvent.setup()
    render(<App repository={createMemoryStudySetRepository()} auth={createMemoryAuth()} />)

    await user.click(await screen.findByRole('button', { name: 'はじめての方はアカウントを作る' }))
    await user.type(screen.getByLabelText('メールアドレス'), 'new@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'secret-pass')
    await user.click(screen.getByRole('button', { name: '登録する' }))
    await screen.findByRole('heading', { name: '学習セット' })

    await user.click(screen.getByRole('button', { name: 'ログアウト' }))
    expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
  })

  it('確認メールが必要な設定なら、そのことを伝える', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createMemoryStudySetRepository()} auth={createMemoryAuth({ confirmationRequired: true })} />,
    )
    await user.click(await screen.findByRole('button', { name: 'はじめての方はアカウントを作る' }))
    await user.type(screen.getByLabelText('メールアドレス'), 'new@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'secret-pass')
    await user.click(screen.getByRole('button', { name: '登録する' }))
    expect(await screen.findByRole('status')).toHaveTextContent('確認メールを送りました')
  })
})

describe('学習セットを編集する', () => {
  it('答えを直し、カードを足し、↑で並べ替えて保存すると、セットの画面に反映される', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}`
    render(<App repository={createMemoryStudySetRepository([sample()])} auth={signedIn()} />)

    await user.click(await screen.findByRole('link', { name: '編集' }))
    const answer1 = await screen.findByLabelText('1枚目の答え')
    expect(answer1).toHaveValue('食べる') // 今の中身が入っている

    await user.clear(answer1)
    await user.type(answer1, '食べる（動詞）')
    await user.click(screen.getByRole('button', { name: '＋ カードを追加' }))
    await user.type(screen.getByLabelText('4枚目の問題'), '자다')
    await user.type(screen.getByLabelText('4枚目の答え'), '寝る')
    await user.click(screen.getByRole('button', { name: '3枚目を上へ' })) // 보다 を2番目へ
    await user.click(screen.getByRole('button', { name: '保存する' }))

    await screen.findByRole('heading', { level: 1, name: '韓国語 動詞' })
    expect(cardTexts()).toEqual(['먹다食べる（動詞）', '보다見る', '가다行く', '자다寝る'])
  })

  it('カードを削除して保存すると、そのカードは消える', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}/edit`
    render(<App repository={createMemoryStudySetRepository([sample()])} auth={signedIn()} />)

    await user.click(await screen.findByRole('button', { name: '2枚目を削除' }))
    await user.click(screen.getByRole('button', { name: '保存する' }))
    await screen.findByRole('heading', { level: 1, name: '韓国語 動詞' })
    expect(cardTexts()).toEqual(['먹다食べる', '보다見る'])
  })

  it('一番上のカードは「上へ」、一番下のカードは「下へ」を押せない', async () => {
    window.location.hash = `#/sets/${SET_ID}/edit`
    render(<App repository={createMemoryStudySetRepository([sample()])} auth={signedIn()} />)
    expect(await screen.findByRole('button', { name: '1枚目を上へ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3枚目を下へ' })).toBeDisabled()
  })
})

describe('学習セットを削除する', () => {
  it('確認のあと削除すると一覧に戻り、セットは消えている', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}`
    render(<App repository={createMemoryStudySetRepository([sample()])} auth={signedIn()} />)

    await user.click(await screen.findByRole('button', { name: 'このセットを削除' }))
    const confirm = screen.getByRole('group', { name: '削除の確認' })
    expect(confirm).toHaveTextContent('カード3枚を削除します')
    await user.click(within(confirm).getByRole('button', { name: '削除する' }))

    expect(await screen.findByText('まだ学習セットがありません。')).toBeInTheDocument()
  })

  it('「やめる」を押せば削除しない', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}`
    render(<App repository={createMemoryStudySetRepository([sample()])} auth={signedIn()} />)

    await user.click(await screen.findByRole('button', { name: 'このセットを削除' }))
    await user.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.getByRole('button', { name: 'このセットを削除' })).toBeInTheDocument()
    expect(cardTexts()).toHaveLength(3)
  })
})
