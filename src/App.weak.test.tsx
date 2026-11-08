// 苦手だけで学ぶ、を画面の操作として確かめるテスト。
// 「前に解いた記録」（history）を用意してから、苦手の枚数・苦手だけの出題・記録を確かめる。
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import { createMemoryScratchNoteRepository } from './lib/scratchNoteRepository'
import type { StudySet } from './lib/studySet'
import type { Direction, NewStudySession } from './lib/studySession'
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
    { id: 'c4', position: 3, question: '자다', answer: '寝る' },
    { id: 'c5', position: 4, question: '읽다', answer: '読む' },
  ],
})
const signedIn = () => createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })

/** 前に解いた1回分の記録。results：[カード, 1周目で正解したか] */
const past = (direction: Direction, at: string, results: [string, boolean][]): NewStudySession => ({
  setId: SET_ID,
  method: 'typing',
  mode: 'test',
  direction,
  startedAt: at,
  attempts: results.map(([cardId, correct]) => ({
    cardId,
    round: 1,
    given: correct ? '（正解）' : '（間違い）',
    judgedCorrect: correct,
    overridden: false,
    answeredAt: at,
  })),
})

// ふつうの向き：c2 と c4 が苦手（c1 は一度間違えたが、あとで正解した）。逆向き：c5 が苦手
const HISTORY = [
  past('forward', '2026-11-01T10:00:00.000Z', [
    ['c1', false],
    ['c2', false],
    ['c3', true],
  ]),
  past('forward', '2026-11-02T10:00:00.000Z', [
    ['c1', true],
    ['c4', false],
  ]),
  past('reverse', '2026-11-03T10:00:00.000Z', [
    ['c5', false],
    ['c2', true],
  ]),
]

function renderApp(history: NewStudySession[] = HISTORY) {
  const repo = createMemoryStudySetRepository([sample()], { history })
  render(<App repository={repo} auth={signedIn()} notes={createMemoryScratchNoteRepository()} />)
  return repo
}

/** はじめる前の設定で「シャッフルなし」「苦手だけ」にしてはじめる */
async function startWeakOnly(user: ReturnType<typeof userEvent.setup>, mode: string) {
  await user.click(await screen.findByRole('radio', { name: new RegExp(mode) }))
  await user.click(screen.getByLabelText('順番をシャッフル'))
  await user.click(await screen.findByLabelText(/苦手だけ（2枚）/))
  await user.click(screen.getByRole('button', { name: 'はじめる' }))
}

beforeEach(() => {
  window.location.hash = `#/sets/${SET_ID}`
})

describe('セットの画面', () => {
  it('苦手の枚数が向きごとに出る。記録がなければ出ない', async () => {
    renderApp()
    expect(await screen.findByText('・苦手 2枚（逆向き 1枚）')).toBeInTheDocument()
  })

  it('苦手が1枚もなければ、何も出さない', async () => {
    renderApp([])
    expect(await screen.findByText('5枚')).toBeInTheDocument()
    expect(screen.queryByText(/苦手/)).not.toBeInTheDocument()
  })
})

describe('入力で、苦手だけ', () => {
  beforeEach(() => {
    window.location.hash = `#/sets/${SET_ID}/type`
  })

  it('苦手のカードだけが出て、正解すると苦手から外れる', async () => {
    const user = userEvent.setup()
    const repo = renderApp()
    await startWeakOnly(user, 'テストモード')

    // 苦手の c2・c4 だけが、セットの並び順に出る
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('가다')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/を入力$/), '行く{Enter}')
    await user.click(screen.getByRole('button', { name: /次へ/ }))
    expect(screen.getByText('자다')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/を入力$/), 'ねる{Enter}') // まだ覚えていない
    await user.click(screen.getByRole('button', { name: /次へ/ }))

    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('1 / 2')
    expect(screen.getByText(/テストモード・苦手だけ/)).toBeInTheDocument()
    expect(await screen.findByText('記録を保存しました')).toBeInTheDocument()
    expect(repo.recorded[0].attempts.map((a) => [a.cardId, a.judgedCorrect])).toEqual([
      ['c2', true],
      ['c4', false],
    ])

    // 正解した c2 は苦手から外れ、間違えた c4 は残る
    await user.click(screen.getByRole('link', { name: 'セットに戻る' }))
    expect(await screen.findByText('・苦手 1枚（逆向き 1枚）')).toBeInTheDocument()
  })

  it('逆向きにすると、逆向きの苦手の枚数になる。苦手がない向きでは選べない', async () => {
    const user = userEvent.setup()
    renderApp([HISTORY[2]]) // 逆向きの記録だけ
    expect(await screen.findByLabelText('苦手だけ（0枚）')).toBeDisabled()
    expect(screen.getByText(/苦手なカードはまだありません/)).toBeInTheDocument()

    await user.click(screen.getByLabelText(/逆向き/))
    const weak = screen.getByLabelText('苦手だけ（1枚）')
    expect(weak).toBeEnabled()
    await user.click(weak)
    await user.click(screen.getByLabelText('順番をシャッフル'))
    await user.click(screen.getByRole('button', { name: 'はじめる' }))

    // 逆向きなので、答え（読む）を見て問題を打つ
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('読む')).toBeInTheDocument()
  })

  it('「苦手だけ」を選ばなければ、今までどおり全部のカードが出る', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('radio', { name: /テストモード/ }))
    await screen.findByLabelText('苦手だけ（2枚）')
    await user.click(screen.getByRole('button', { name: 'はじめる' }))
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
  })
})

describe('4択で、苦手だけ', () => {
  it('苦手が少なくても、選択肢はセット全体から4つ作る', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}/choice`
    const repo = renderApp()
    await startWeakOnly(user, 'テストモード')

    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('가다')).toBeInTheDocument()
    const options = within(screen.getByRole('list', { name: '選択肢' }))
    expect(options.getAllByRole('button')).toHaveLength(4)
    await user.click(options.getByRole('button', { name: /行く/ }))
    await user.click(screen.getByRole('button', { name: /次へ/ }))
    await user.click(within(screen.getByRole('list', { name: '選択肢' })).getByRole('button', { name: /寝る/ }))
    await user.click(screen.getByRole('button', { name: /次へ/ }))

    expect(await screen.findByText('記録を保存しました')).toBeInTheDocument()
    expect(repo.recorded[0]).toMatchObject({ method: 'choice' })
    expect(repo.recorded[0].attempts.map((a) => a.cardId)).toEqual(['c2', 'c4'])
  })
})

describe('マッチで、苦手だけ', () => {
  it('苦手が3組に足りなければ、ほかのカードで盤を埋める。埋めたカードは記録しない', async () => {
    const user = userEvent.setup()
    window.location.hash = `#/sets/${SET_ID}/match`
    const repo = renderApp()
    await startWeakOnly(user, 'テストモード')

    // 苦手の2組（가다・자다）＋埋め合わせの1組で、3組の盤になる
    const leftList = screen.getByRole('list', { name: /左の列/ })
    const tiles = within(leftList).getAllByRole('button')
    expect(tiles).toHaveLength(3)
    expect(leftList).toHaveTextContent('가다')
    expect(leftList).toHaveTextContent('자다')

    // 全部そろえる（左の札の問題に合う答えを、右から選ぶ）
    const answers: Record<string, string> = {
      먹다: '食べる',
      가다: '行く',
      보다: '見る',
      자다: '寝る',
      읽다: '読む',
    }
    for (const tile of tiles) {
      const question = Object.keys(answers).find((q) => tile.textContent?.includes(q))
      if (!question) throw new Error('左の札の問題が見つかりません')
      await user.click(tile)
      await user.click(
        within(screen.getByRole('list', { name: /右の列/ })).getByRole('button', {
          name: new RegExp(answers[question]),
        }),
      )
    }

    await user.click(screen.getByRole('button', { name: /結果を見る/ }))

    expect(await screen.findByText('記録を保存しました')).toBeInTheDocument()
    expect(repo.recorded[0]).toMatchObject({ method: 'match' })
    expect(repo.recorded[0].attempts.map((a) => a.cardId).sort()).toEqual(['c2', 'c4'])
  })
})
