// 4択で学ぶ、と「4枚未満なら暗い札＋吹き出し」を、画面の操作として確かめるテスト。
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import { createMemoryScratchNoteRepository } from './lib/scratchNoteRepository'
import type { StudySet } from './lib/studySet'
import { createMemoryStudySetRepository } from './lib/studySetRepository'

const SET_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const PAIRS = [
  ['먹다', '食べる'],
  ['가다', '行く'],
  ['보다', '見る'],
  ['자다', '寝る'],
]
const sample = (n = 4): StudySet => ({
  id: SET_ID,
  title: '韓国語 動詞',
  description: null,
  created_at: '2026-09-30T00:00:00Z',
  cards: PAIRS.slice(0, n).map(([question, answer], i) => ({ id: `c${i + 1}`, position: i, question, answer })),
})
const signedIn = () => createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })

function renderApp(set: StudySet) {
  const repo = createMemoryStudySetRepository([set])
  render(<App repository={repo} auth={signedIn()} notes={createMemoryScratchNoteRepository()} />)
  return repo
}

/** 選択肢のボタン（文字で探す。並びは毎回混ざるため） */
const option = (text: string) =>
  within(screen.getByRole('list', { name: '選択肢' })).getByRole('button', { name: new RegExp(text) })

/** 4択の画面を開き、モードを選んで（シャッフルなしで）はじめる */
async function start(user: ReturnType<typeof userEvent.setup>, mode: string) {
  await user.click(await screen.findByRole('radio', { name: new RegExp(mode) }))
  await user.click(screen.getByLabelText('順番をシャッフル'))
  await user.click(screen.getByRole('button', { name: 'はじめる' }))
}

beforeEach(() => {
  window.location.hash = `#/sets/${SET_ID}`
})

describe('4枚未満のセット', () => {
  it('「4択」の札は暗く押せず、マウスを乗せると理由の吹き出しが出る', async () => {
    const user = userEvent.setup()
    renderApp(sample(3))
    const tile = await screen.findByRole('link', { name: /4択/ })
    expect(tile).toHaveAttribute('aria-disabled', 'true')
    expect(tile).not.toHaveAttribute('href')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.hover(tile)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '4択は、カードが4枚以上あるセットで使えます（いまは3枚）',
    )
    await user.unhover(tile)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  })

  it('タップ（クリック）やキーボードで選んだときも吹き出しが出る。読み上げにも理由が伝わる', async () => {
    const user = userEvent.setup()
    renderApp(sample(3))
    const tile = await screen.findByRole('link', { name: /4択/ })
    expect(tile).toHaveAccessibleDescription(/4枚以上/)

    await user.click(tile)
    expect(await screen.findByRole('tooltip')).toBeInTheDocument()
    expect(window.location.hash).toBe(`#/sets/${SET_ID}`) // 画面は移らない
  })

  it('URL を直接開いても、理由が出て始まらない', async () => {
    window.location.hash = `#/sets/${SET_ID}/choice`
    renderApp(sample(3))
    expect(await screen.findByText(/カードが4枚以上あるセットで使えます/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'はじめる' })).not.toBeInTheDocument()
  })
})

describe('4択で学ぶ', () => {
  it('4枚あれば選べる。通常モード：間違えた問題は2周目にもう一度出て、記録が「4択」で残る', async () => {
    const user = userEvent.setup()
    const repo = renderApp(sample())
    await user.click(await screen.findByRole('link', { name: /4択/ }))
    await start(user, '通常モード')

    expect(screen.getByText('먹다')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: '選択肢' })).getAllByRole('button')).toHaveLength(4)
    await user.click(option('食べる'))
    expect(screen.getByRole('alert')).toHaveTextContent('正解！')
    await user.keyboard('{Enter}') // 「次へ」

    // 2問目はわざと間違える：選んだものは赤、正解は緑
    const wrong = within(screen.getByRole('list', { name: '選択肢' }))
      .getAllByRole('button')
      .find((b) => !b.textContent?.includes('行く'))!
    await user.click(wrong)
    expect(screen.getByRole('alert')).toHaveTextContent('不正解')
    expect(wrong).toHaveClass('is-wrong')
    expect(option('行く')).toHaveClass('is-correct')
    await user.keyboard('{Enter}')

    await user.click(option('見る'))
    await user.keyboard('{Enter}')
    await user.click(option('寝る'))
    await user.keyboard('{Enter}')

    expect(screen.getByText(/2周目/)).toBeInTheDocument()
    await user.click(option('行く'))
    await user.keyboard('{Enter}')

    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('3 / 4')
    expect(await screen.findByText('記録を保存しました')).toBeInTheDocument()
    expect(repo.recorded[0]).toMatchObject({ method: 'choice', mode: 'normal', direction: 'forward' })

    await user.click(screen.getByRole('link', { name: 'セットに戻る' }))
    expect(await screen.findByRole('list', { name: '最近の記録' })).toHaveTextContent('4択・通常')
  })

  it('キーボードの 1〜4 で選べる', async () => {
    const user = userEvent.setup()
    renderApp(sample())
    window.location.hash = `#/sets/${SET_ID}/choice`
    await start(user, 'テストモード')
    const buttons = within(screen.getByRole('list', { name: '選択肢' })).getAllByRole('button')
    const n = buttons.findIndex((b) => b.textContent?.includes('食べる')) + 1
    await user.keyboard(String(n))
    expect(screen.getByRole('alert')).toHaveTextContent('正解！')
  })

  it('徹底モード：間違えたら、正解を選び直すまで次に進めない。外れた選択肢はもう押せない', async () => {
    const user = userEvent.setup()
    renderApp(sample())
    window.location.hash = `#/sets/${SET_ID}/choice`
    await start(user, '徹底モード')
    const wrong = within(screen.getByRole('list', { name: '選択肢' }))
      .getAllByRole('button')
      .find((b) => !b.textContent?.includes('食べる'))!
    await user.click(wrong)
    expect(screen.getByRole('alert')).toHaveTextContent('正解を選び直してください')
    expect(wrong).toBeDisabled()
    expect(screen.queryByRole('button', { name: /次へ/ })).not.toBeInTheDocument()

    // 選び直しでまた外すと、それも押せなくなる
    const wrong2 = within(screen.getByRole('list', { name: '選択肢' }))
      .getAllByRole('button')
      .find((b) => b !== wrong && !b.textContent?.includes('食べる'))!
    await user.click(wrong2)
    expect(wrong2).toBeDisabled()
    expect(wrong2).toHaveClass('is-wrong')

    await user.click(option('食べる'))
    expect(await screen.findByText('가다')).toBeInTheDocument() // 次の問題へ
  })

  it('逆向きでは、答えを見て問題を選ぶ', async () => {
    const user = userEvent.setup()
    renderApp(sample())
    window.location.hash = `#/sets/${SET_ID}/choice`
    await user.click(await screen.findByLabelText(/逆向き/))
    await start(user, 'テストモード')
    expect(screen.getByText('食べる')).toBeInTheDocument()
    await user.click(option('먹다'))
    expect(screen.getByRole('alert')).toHaveTextContent('正解！')
  })
})
