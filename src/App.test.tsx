// 利用シナリオ（セットを作る → 一覧に出る → カードで学ぶ）を、画面の操作として確かめるテスト。
// 保存先はメモリ上の実装に差し替えるので、Supabase がなくても動く。
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import type { StudySet } from './lib/studySet'
import { createMemoryStudySetRepository } from './lib/studySetRepository'

const SET_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const sample: StudySet = {
  id: SET_ID,
  title: '韓国語 動詞',
  description: null,
  created_at: '2026-09-30T00:00:00Z',
  cards: [
    { id: 'c1', position: 0, question: '먹다', answer: '食べる' },
    { id: 'c2', position: 1, question: '가다', answer: '行く' },
  ],
}

// ログイン済みの状態から始めるための偽のログイン窓口
const signedIn = () => createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })

beforeEach(() => {
  window.location.hash = ''
})

describe('学習セットを作る', () => {
  it('タイトルとカードを入れて作成すると、セットの画面に移り、一覧にも出る', async () => {
    const user = userEvent.setup()
    render(<App repository={createMemoryStudySetRepository()} auth={signedIn()} />)

    await user.click(await screen.findByRole('link', { name: '＋ 新しいセット' }))
    await user.type(await screen.findByLabelText('タイトル'), '線形代数 第3章')
    await user.type(screen.getByLabelText('1枚目の問題'), 'Av = λv を満たす λ')
    await user.type(screen.getByLabelText('1枚目の答え'), '固有値')
    await user.type(screen.getByLabelText('2枚目の問題'), 'det(A − λI) = 0')
    await user.type(screen.getByLabelText('2枚目の答え'), '固有方程式')
    await user.click(screen.getByRole('button', { name: '作成する' }))

    // 作成後はセットの画面（入力しなかった3枚目は保存されない）
    expect(await screen.findByRole('heading', { level: 1, name: '線形代数 第3章' })).toBeInTheDocument()
    const cards = within(screen.getByRole('list', { name: 'カード一覧' })).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(cards[1]).toHaveTextContent('固有方程式')

    await user.click(screen.getByRole('link', { name: '← 一覧へ' }))
    const list = await screen.findByRole('list', { name: '学習セットの一覧' })
    expect(list).toHaveTextContent('線形代数 第3章')
    expect(list).toHaveTextContent('2枚')
  })

  it('最後の答えで Tab を押すとカードが増え、その問題欄に移る', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/new'
    render(<App repository={createMemoryStudySetRepository()} auth={signedIn()} />)

    await user.click(await screen.findByLabelText('3枚目の答え'))
    await user.tab()
    expect(screen.getByLabelText('4枚目の問題')).toHaveFocus()
  })

  it('答えが空のカードがあると作成せず、何枚目かを伝える', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/new'
    render(<App repository={createMemoryStudySetRepository()} auth={signedIn()} />)

    await user.type(await screen.findByLabelText('タイトル'), 'テスト')
    await user.type(screen.getByLabelText('1枚目の問題'), '問題だけ')
    await user.click(screen.getByRole('button', { name: '作成する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('1枚目の答えが空です')
    expect(screen.getByLabelText('1枚目の答え')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('カードで学ぶ', () => {
  it('クリックでめくり、次へで次のカード。最後まで行くと終了画面', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}/cards`
    render(<App repository={createMemoryStudySetRepository([sample])} auth={signedIn()} />)

    const card = await screen.findByRole('button', { name: /問題\s*먹다/ })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    await user.click(card)
    expect(screen.getByRole('button', { name: /答え\s*食べる/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '次へ →' }))
    expect(screen.getByRole('button', { name: /問題\s*가다/ })).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '次へ →' }))
    expect(screen.getByRole('heading', { name: '全2枚をめくりました' })).toBeInTheDocument()
  })

  it('キーボードで操作できる（Space めくる、→ 次へ、← 前へ）', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}/cards`
    render(<App repository={createMemoryStudySetRepository([sample])} auth={signedIn()} />)
    await screen.findByRole('button', { name: /問題\s*먹다/ })

    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: /答え\s*食べる/ })).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: /問題\s*가다/ })).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: /問題\s*먹다/ })).toBeInTheDocument()
  })

  it('「答えを先に出す」で表裏が入れ替わる', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}/cards`
    render(<App repository={createMemoryStudySetRepository([sample])} auth={signedIn()} />)
    await screen.findByRole('button', { name: /問題\s*먹다/ })

    await user.click(screen.getByLabelText('答えを先に出す'))
    expect(screen.getByRole('button', { name: /答え\s*食べる/ })).toBeInTheDocument()
  })

  it('存在しないセットは「見つかりません」', async () => {
    window.location.hash = '#/sets/00000000-0000-4000-8000-000000000000/cards'
    render(<App repository={createMemoryStudySetRepository([sample])} auth={signedIn()} />)
    expect(await screen.findByRole('heading', { name: '学習セットが見つかりません' })).toBeInTheDocument()
  })
})

it('保存先が未設定なら、設定の案内を出す', () => {
  render(<App repository={null} auth={null} />)
  expect(screen.getByRole('alert')).toHaveTextContent('VITE_SUPABASE_URL')
})
