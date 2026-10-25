// マッチで学ぶ、と「4枚未満なら暗い札＋吹き出し」を、画面の操作として確かめるテスト。
// 右の列の並びは毎回混ざるので、札は文字で探す。
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
  ['읽다', '読む'],
  ['쓰다', '書く'],
  ['듣다', '聞く'],
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

const leftList = () => screen.getByRole('list', { name: /左の列/ })
const rightList = () => screen.getByRole('list', { name: /右の列/ })
const left = (text: string) => within(leftList()).getByRole('button', { name: new RegExp(text) })
const right = (text: string) => within(rightList()).getByRole('button', { name: new RegExp(text) })

/** マッチの画面を開き、モードを選んで（シャッフルなしで）はじめる */
async function start(user: ReturnType<typeof userEvent.setup>, mode: string) {
  await user.click(await screen.findByRole('radio', { name: new RegExp(mode) }))
  await user.click(screen.getByLabelText('順番をシャッフル'))
  await user.click(screen.getByRole('button', { name: 'はじめる' }))
}

/** 左の札を選んでから、右の札を選ぶ */
async function pair(user: ReturnType<typeof userEvent.setup>, q: string, a: string) {
  await user.click(left(q))
  await user.click(right(a))
}

beforeEach(() => {
  window.location.hash = `#/sets/${SET_ID}`
})

describe('4枚未満のセット', () => {
  it('「マッチ」の札は暗く押せず、マウスを乗せると理由の吹き出しが出る', async () => {
    const user = userEvent.setup()
    renderApp(sample(3))
    const tile = await screen.findByRole('link', { name: /マッチ/ })
    expect(tile).toHaveAttribute('aria-disabled', 'true')
    expect(tile).not.toHaveAttribute('href')
    await user.hover(tile)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'マッチは、カードが4枚以上あるセットで使えます（いまは3枚）',
    )
  })

  it('URL を直接開いても、理由が出て始まらない', async () => {
    window.location.hash = `#/sets/${SET_ID}/match`
    renderApp(sample(3))
    expect(await screen.findByText(/マッチは、カードが4枚以上あるセットで使えます/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'はじめる' })).not.toBeInTheDocument()
  })
})

describe('マッチで学ぶ', () => {
  it('モードは「通常」と「テスト」の2つだけ', async () => {
    window.location.hash = `#/sets/${SET_ID}/match`
    renderApp(sample())
    expect(await screen.findAllByRole('radio')).toHaveLength(2)
    expect(screen.queryByRole('radio', { name: /徹底/ })).not.toBeInTheDocument()
  })

  it('テストモード：そろえると札が消え、外すと揺れて選び直し。記録は最初の1回だけで「マッチ」として残る', async () => {
    const user = userEvent.setup()
    const repo = renderApp(sample())
    await user.click(await screen.findByRole('link', { name: /マッチ/ }))
    await start(user, 'テストモード')

    expect(within(leftList()).getAllByRole('button')).toHaveLength(4)
    // 左を選ぶまで、右は押せない
    expect(right('食べる')).toBeDisabled()

    await pair(user, '먹다', '食べる')
    expect(screen.getByText('そろいました')).toBeInTheDocument()
    expect(left('먹다')).toBeDisabled()
    expect(left('먹다')).toHaveClass('is-matched')

    // 外す：2枚が赤くなり、選ぶのをやめる。もう一度選び直せる
    await pair(user, '가다', '見る')
    expect(screen.getByText(/違います/)).toBeInTheDocument()
    expect(left('가다')).toHaveClass('is-wrong')
    expect(right('見る')).toHaveClass('is-wrong')
    expect(left('가다')).toBeEnabled()
    await pair(user, '가다', '寝る') // もう一度外す（記録しない）
    await pair(user, '가다', '行く')
    await pair(user, '보다', '見る')
    await pair(user, '자다', '寝る')

    expect(screen.getByRole('alert')).toHaveTextContent('この盤はそろいました')
    await user.keyboard('{Enter}') // 「結果を見る」

    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('3 / 4')
    expect(result).toHaveTextContent(/かかった時間 \d+秒/)
    expect(screen.getByRole('list', { name: '間違えた問題' })).toHaveTextContent('가다見る→ 行く')
    expect(await screen.findByText('記録を保存しました')).toBeInTheDocument()
    expect(repo.recorded[0]).toMatchObject({ method: 'match', mode: 'test', direction: 'forward' })
    expect(repo.recorded[0].attempts).toHaveLength(4) // 1枚につき1回

    await user.click(screen.getByRole('link', { name: 'セットに戻る' }))
    expect(await screen.findByRole('list', { name: '最近の記録' })).toHaveTextContent('マッチ・テスト')
  })

  it('通常モード：最初に外した組は、2周目の盤にもう一度出る（足りない分はほかの札で埋め、記録しない）', async () => {
    const user = userEvent.setup()
    const repo = renderApp(sample())
    window.location.hash = `#/sets/${SET_ID}/match`
    await start(user, '通常モード')

    await pair(user, '먹다', '行く') // 먹다 を外す
    await pair(user, '먹다', '食べる')
    await pair(user, '가다', '行く')
    await pair(user, '보다', '見る')
    await pair(user, '자다', '寝る')
    await user.click(screen.getByRole('button', { name: /次の盤へ/ }))

    expect(screen.getByText(/2周目/)).toBeInTheDocument()
    const tiles = within(leftList()).getAllByRole('button')
    expect(tiles).toHaveLength(3) // 外した1組＋埋め合わせ2組
    expect(left('먹다')).toBeInTheDocument()
    for (const b of tiles) {
      const q = b.textContent!.replace(/^\d/, '')
      await user.click(b)
      await user.click(right(PAIRS.find(([x]) => x === q)![1]))
    }
    await user.click(screen.getByRole('button', { name: /結果を見る/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('3 / 4') // 点数は1周目
    await waitFor(() => expect(repo.recorded).toHaveLength(1))
    const rounds = repo.recorded[0].attempts.map((a) => a.round)
    expect(rounds.filter((r) => r === 1)).toHaveLength(4)
    expect(repo.recorded[0].attempts.filter((a) => a.round === 2).map((a) => a.cardId)).toEqual(['c1'])
  })

  it('7枚なら4組と3組の2つの盤に分かれる。キーボードの数字で左、a〜 で右を選べる', async () => {
    const user = userEvent.setup()
    renderApp(sample(7))
    window.location.hash = `#/sets/${SET_ID}/match`
    await start(user, 'テストモード')
    expect(screen.getByText(/盤 1 \/ 2/)).toBeInTheDocument()
    expect(within(leftList()).getAllByRole('button')).toHaveLength(4)

    await user.keyboard('1') // 먹다
    expect(left('먹다')).toHaveAttribute('aria-pressed', 'true')
    const key = within(rightList())
      .getAllByRole('button')
      .findIndex((b) => b.textContent?.includes('食べる'))
    await user.keyboard('abcd'[key])
    expect(left('먹다')).toHaveClass('is-matched')

    await pair(user, '가다', '行く')
    await pair(user, '보다', '見る')
    await pair(user, '자다', '寝る')
    await user.keyboard('{Enter}')
    expect(screen.getByText(/盤 2 \/ 2/)).toBeInTheDocument()
    expect(within(leftList()).getAllByRole('button')).toHaveLength(3)
  })

  it('逆向きでは、左に答え、右に問題が並ぶ', async () => {
    const user = userEvent.setup()
    renderApp(sample())
    window.location.hash = `#/sets/${SET_ID}/match`
    await user.click(await screen.findByLabelText(/逆向き/))
    await start(user, 'テストモード')
    expect(left('食べる')).toBeInTheDocument()
    await pair(user, '食べる', '먹다')
    expect(screen.getByText('そろいました')).toBeInTheDocument()
  })
})
