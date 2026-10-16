// クレジット（右上の残高と、学習でもらえる分）を、画面の操作として確かめるテスト。
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import { createMemoryBlackjackRepository } from './lib/blackjackRepository'
import { createMemoryCreditRepository } from './lib/creditRepository'
import type { StudySet } from './lib/studySet'
import { createMemoryScratchNoteRepository } from './lib/scratchNoteRepository'
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
  ],
})
const signedIn = () => createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })
const balance = () => screen.getByTitle('所持クレジット')

function renderApp(options: { initial?: number; failRecord?: boolean } = {}) {
  const credits = createMemoryCreditRepository(options.initial ?? 0)
  const repository = createMemoryStudySetRepository([sample()], { credits, failRecord: options.failRecord })
  render(
    <App
      repository={repository}
      auth={signedIn()}
      notes={createMemoryScratchNoteRepository()}
      credits={credits}
      casino={createMemoryBlackjackRepository({ credits: createMemoryCreditRepository() })}
    />,
  )
  return { credits, repository }
}

/** テストモードで、シャッフルなしで2問に答える */
async function playTest(user: ReturnType<typeof userEvent.setup>, answers: string[], override = false) {
  window.location.hash = `#/sets/${SET_ID}/type`
  await user.click(await screen.findByRole('radio', { name: /テストモード/ }))
  await user.click(screen.getByLabelText('順番をシャッフル'))
  await user.click(screen.getByRole('button', { name: 'はじめる' }))
  for (const answer of answers) {
    await user.type(screen.getByLabelText(/を入力$/), `${answer}{Enter}`)
    if (override && screen.getByRole('alert').textContent === '不正解')
      await user.click(screen.getByRole('button', { name: '正解にする' }))
    await user.click(screen.getByRole('button', { name: /次へ/ }))
  }
}

beforeEach(() => {
  window.location.hash = ''
})

describe('クレジット', () => {
  it('右上に所持クレジットが3桁区切りで出る', async () => {
    renderApp({ initial: 12340 })
    expect(await screen.findByText('12,340')).toBeInTheDocument()
    expect(balance()).toHaveTextContent('所持クレジット 12,340')
  })

  it('全問正解すると 2問×100×1.5 = 300 もらえ、右上の残高もすぐ増える', async () => {
    const user = userEvent.setup()
    renderApp({ initial: 1000 })
    await screen.findByText('1,000')

    await playTest(user, ['食べる', '行く'])
    expect(await screen.findByText('+300 クレジット')).toBeInTheDocument()
    expect(await screen.findByText('1,300')).toBeInTheDocument()
    expect(balance()).toHaveTextContent('1,300')
  })

  it('「正解にする」で正解にした問題は半分：(100 + 50) × 1.5 = 225', async () => {
    const user = userEvent.setup()
    renderApp()
    await playTest(user, ['食べる', 'いく'], true)
    expect(await screen.findByText('+225 クレジット')).toBeInTheDocument()
    expect(await screen.findByText('225')).toBeInTheDocument()
  })

  it('全部間違えたらクレジットなし', async () => {
    const user = userEvent.setup()
    renderApp({ initial: 50 })
    await playTest(user, ['x', 'y'])
    expect(await screen.findByText('今回はクレジットなし')).toBeInTheDocument()
    expect(balance()).toHaveTextContent('50')
  })

  it('記録を保存できなかったら、クレジットはもらえない（もらったように見せない）', async () => {
    const user = userEvent.setup()
    renderApp({ initial: 0, failRecord: true })
    await playTest(user, ['食べる', '行く'])
    expect(await screen.findByText(/保存できるまで、クレジットはもらえません/)).toBeInTheDocument()
    expect(screen.queryByText(/\+\d+ クレジット/)).not.toBeInTheDocument()
    expect(balance()).toHaveTextContent('0')
  })

  it('残高を読み込めなかったら「—」を出す', async () => {
    render(
      <App
        repository={createMemoryStudySetRepository()}
        auth={signedIn()}
        notes={createMemoryScratchNoteRepository()}
        credits={createMemoryCreditRepository(0, { failLoad: true })}
        casino={createMemoryBlackjackRepository({ credits: createMemoryCreditRepository() })}
      />,
    )
    expect(await screen.findByTitle('クレジットを読み込めませんでした')).toHaveTextContent('—')
  })
})
