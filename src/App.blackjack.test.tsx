// カジノのブラックジャックを、画面の操作として確かめるテスト。山札を決めておくので、結果が毎回同じになる。
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import type { Card } from './lib/blackjack'
import { createMemoryBlackjackRepository } from './lib/blackjackRepository'
import { createMemoryCreditRepository } from './lib/creditRepository'
import { createMemoryScratchNoteRepository } from './lib/scratchNoteRepository'
import { createMemoryStudySetRepository } from './lib/studySetRepository'

/** 山札（♠だけ）。配る順：プレイヤー・ディーラー・プレイヤー・ディーラー・そのあと引く順 */
const deck = (...ranks: number[]): Card[] => ranks.map((r) => r - 1)
const signedIn = () => createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })
const balance = () => screen.getByTitle('所持クレジット')
/** 右上の残高がこの数字になるまで待つ（チップの「1,000」などと区別するため、残高の場所だけを見る） */
const balanceShows = (text: string) => screen.findByText(text, { selector: '.credit-amount' })

function renderCasino(initial: number, decks: Card[][] = []) {
  const credits = createMemoryCreditRepository(initial)
  const casino = createMemoryBlackjackRepository({ credits, decks })
  render(
    <App
      repository={createMemoryStudySetRepository()}
      auth={signedIn()}
      notes={createMemoryScratchNoteRepository()}
      credits={credits}
      casino={casino}
    />,
  )
  return { credits, casino }
}

/** チップを積んで配る */
async function deal(user: ReturnType<typeof userEvent.setup>, ...chips: string[]) {
  await screen.findByRole('heading', { name: 'ブラックジャック' })
  for (const chip of chips) await user.click(screen.getByRole('button', { name: `${chip} を積む` }))
  await user.click(screen.getByRole('button', { name: '配る' }))
}

beforeEach(() => {
  window.location.hash = '#/casino/blackjack'
})

describe('ブラックジャック', () => {
  it('ヘッダーの「カジノ」から開ける', async () => {
    window.location.hash = ''
    const user = userEvent.setup()
    renderCasino(1000)
    await user.click(await screen.findByRole('link', { name: 'カジノ' }))
    expect(await screen.findByRole('heading', { name: 'ブラックジャック' })).toBeInTheDocument()
  })

  it('チップは所持金を超えて積めない', async () => {
    const user = userEvent.setup()
    renderCasino(1200)
    await balanceShows('1,200')
    await user.click(await screen.findByRole('button', { name: '500 を積む' }))
    await user.click(screen.getByRole('button', { name: '500 を積む' }))
    expect(screen.getByText('1,000', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '500 を積む' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '100 を積む' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'クリア' }))
    expect(screen.getByRole('button', { name: '配る' })).toBeDisabled() // 0 では配れない
  })

  it('ブラックジャックは 3:2。100 賭けて +150、右上も増える', async () => {
    const user = userEvent.setup()
    renderCasino(1000, [deck(1, 9, 13, 7)])
    await balanceShows('1,000')
    await deal(user, '100')
    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('ブラックジャック！')
    expect(result).toHaveTextContent('+150')
    expect(await balanceShows('1,150')).toBeInTheDocument()
  })

  it('途中はディーラーの2枚目が伏せてある。ヒットで 21 になると自動で止まり、勝てば +100', async () => {
    const user = userEvent.setup()
    renderCasino(1000, [deck(10, 9, 6, 13, 5)])
    await balanceShows('1,000')
    await deal(user, '100')

    expect(screen.getByRole('img', { name: '伏せたカード' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: /あなたの手札/ })).getAllByRole('img')).toHaveLength(2)
    expect(await balanceShows('900')).toBeInTheDocument() // 賭けた時点で引かれる

    await user.click(screen.getByRole('button', { name: 'ヒット' })) // 10 + 6 + 5 = 21
    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('勝ち！')
    expect(result).toHaveTextContent('+100')
    expect(screen.queryByRole('img', { name: '伏せたカード' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'スペードのK' })).toBeInTheDocument() // 伏せていたカード
    expect(await balanceShows('1,100')).toBeInTheDocument()
  })

  it('21 を超えたら負け（バースト）', async () => {
    const user = userEvent.setup()
    renderCasino(1000, [deck(10, 10, 6, 6, 9)])
    await deal(user, '100')
    await user.click(await screen.findByRole('button', { name: 'ヒット' }))
    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('バースト')
    expect(result).toHaveTextContent('−100')
    expect(balance()).toHaveTextContent('900')
  })

  it('ダブルダウンで勝つと、賭け金の2倍ぶん増える（+200）', async () => {
    const user = userEvent.setup()
    renderCasino(1000, [deck(6, 10, 5, 7, 10)])
    await deal(user, '100')
    await user.click(await screen.findByRole('button', { name: /ダブルダウン/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('+200')
    expect(await balanceShows('1,200')).toBeInTheDocument()
  })

  it('もう一度賭けるだけのクレジットがなければ、ダブルダウンは押せない', async () => {
    const user = userEvent.setup()
    renderCasino(100, [deck(6, 10, 5, 7, 10)])
    await balanceShows('100')
    await deal(user, '100')
    await balanceShows('0')
    expect(screen.getByRole('button', { name: /ダブルダウン/ })).toBeDisabled()
  })

  it('途中で画面を離れても、開き直すと続きから', async () => {
    const credits = createMemoryCreditRepository(1000)
    const casino = createMemoryBlackjackRepository({ credits, decks: [deck(10, 9, 6, 13, 5)] })
    await casino.start(500)
    render(
      <App
        repository={createMemoryStudySetRepository()}
        auth={signedIn()}
        notes={createMemoryScratchNoteRepository()}
        credits={credits}
        casino={casino}
      />,
    )
    expect(await screen.findByRole('button', { name: 'ヒット' })).toBeInTheDocument()
    expect(screen.getByText('賭け金 500')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '伏せたカード' })).toBeInTheDocument()
  })

  it('クレジットが 100 未満なら賭けられず、学習へ案内する', async () => {
    renderCasino(50)
    expect(await screen.findByText(/100 未満なので、賭けられません/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '学習してクレジットを稼ぐ' })).toHaveAttribute('href', '#/')
    expect(screen.queryByRole('button', { name: '配る' })).not.toBeInTheDocument()
  })
})
