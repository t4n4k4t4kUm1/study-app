// 入力で学ぶ（キーボードで答える）を、画面の操作として確かめるテスト。
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
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

/** 入力モードを開き、モードを選んで（シャッフルなしで）はじめる */
async function start(user: ReturnType<typeof userEvent.setup>, mode: string, options: { reverse?: boolean } = {}) {
  await user.click(await screen.findByRole('radio', { name: new RegExp(mode) }))
  await user.click(screen.getByLabelText('順番をシャッフル')) // 順番を固定してテストする
  if (options.reverse) await user.click(screen.getByLabelText(/逆向き/))
  await user.click(screen.getByRole('button', { name: 'はじめる' }))
}
const answerBox = () => screen.getByLabelText(/を入力$/)

beforeEach(() => {
  window.location.hash = `#/sets/${SET_ID}/type`
})

describe('通常モード', () => {
  it('間違えた問題は2周目にもう一度出る。点数は1周目で、記録が保存される', async () => {
    const user = userEvent.setup()
    const repo = createMemoryStudySetRepository([sample()])
    render(<App repository={repo} auth={signedIn()} notes={createMemoryScratchNoteRepository()} />)
    await start(user, '通常モード')

    expect(screen.getByText('먹다')).toBeInTheDocument()
    await user.type(answerBox(), '食べる{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('正解！')
    await user.click(screen.getByRole('button', { name: /次へ/ }))

    await user.type(answerBox(), 'いく{Enter}') // 2問目は間違える
    expect(screen.getByRole('alert')).toHaveTextContent('不正解')
    expect(screen.getByText('行く')).toBeInTheDocument() // 正解が見える
    await user.keyboard('{Enter}') // 「次へ」に Enter が効く

    expect(screen.getByText(/2周目/)).toBeInTheDocument()
    expect(screen.getByText('가다')).toBeInTheDocument()
    await user.type(answerBox(), '行く{Enter}')
    await user.click(screen.getByRole('button', { name: /次へ/ }))

    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('1 / 2')
    expect(result).toHaveTextContent('50%')
    expect(await screen.findByText('記録を保存しました')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: '間違えた問題' })).getByText('いく')).toBeInTheDocument()

    expect(repo.recorded).toHaveLength(1)
    expect(repo.recorded[0]).toMatchObject({ mode: 'normal', direction: 'forward', setId: SET_ID })
    expect(repo.recorded[0].attempts.map((a) => [a.cardId, a.round, a.given, a.judgedCorrect])).toEqual([
      ['c1', 1, '食べる', true],
      ['c2', 1, 'いく', false],
      ['c2', 2, '行く', true],
    ])

    // セットの画面に「最近の記録」として出る
    await user.click(screen.getByRole('link', { name: 'セットに戻る' }))
    const recent = await screen.findByRole('list', { name: '最近の記録' })
    expect(recent).toHaveTextContent('通常')
    expect(recent).toHaveTextContent('1 / 2')
  })
})

describe('テストモードと「正解にする」', () => {
  it('不正解を「正解にする」と点数に入り、記録には「機械は不正解・人が正解にした」と残る', async () => {
    const user = userEvent.setup()
    const repo = createMemoryStudySetRepository([sample()])
    render(<App repository={repo} auth={signedIn()} notes={createMemoryScratchNoteRepository()} />)
    await start(user, 'テストモード')

    await user.type(answerBox(), '食べる。{Enter}') // 句点つき：完全一致なので不正解
    expect(screen.getByRole('alert')).toHaveTextContent('不正解')
    await user.click(screen.getByRole('button', { name: '正解にする' }))
    expect(screen.getByRole('alert')).toHaveTextContent('正解にしました')
    await user.click(screen.getByRole('button', { name: /次へ/ }))

    await user.click(screen.getByRole('button', { name: 'わからない' }))
    await user.click(screen.getByRole('button', { name: /次へ/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('1 / 2') // テストモードは2周目なし
    expect(repo.recorded[0].attempts.map((a) => [a.given, a.judgedCorrect, a.overridden])).toEqual([
      ['食べる。', false, true],
      ['', false, false],
    ])
  })
})

describe('徹底モード', () => {
  it('間違えたら、正しく打ち直すまで次に進めない', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createMemoryStudySetRepository([sample()])}
        auth={signedIn()}
        notes={createMemoryScratchNoteRepository()}
      />,
    )
    await start(user, '徹底モード')

    await user.type(answerBox(), 'たべる{Enter}')
    const retype = screen.getByLabelText('正しい答えを打ち直してください')
    await user.type(retype, 'たべる{Enter}')
    expect(screen.getByText('まだ違います。もう一度打ってください')).toBeInTheDocument()
    expect(screen.getByText('먹다')).toBeInTheDocument() // まだ1問目

    await user.clear(retype)
    await user.type(retype, '食べる{Enter}')
    expect(screen.getByText('가다')).toBeInTheDocument() // 2問目へ進んだ
  })
})

describe('逆向き・日本語入力', () => {
  it('逆向きでは答えを見て問題を打つ', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createMemoryStudySetRepository([sample()])}
        auth={signedIn()}
        notes={createMemoryScratchNoteRepository()}
      />,
    )
    await start(user, 'テストモード', { reverse: true })

    expect(screen.getByText('食べる')).toBeInTheDocument()
    await user.type(answerBox(), '먹다{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('正解！')
  })

  it('日本語入力の変換を確定する Enter では答えない', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createMemoryStudySetRepository([sample()])}
        auth={signedIn()}
        notes={createMemoryScratchNoteRepository()}
      />,
    )
    await start(user, 'テストモード')

    await user.type(answerBox(), '食べる')
    fireEvent.keyDown(answerBox(), { key: 'Enter', keyCode: 229 }) // 変換中の Enter
    await new Promise((r) => setTimeout(r, 50)) // 答え合わせは少し後に終わるので、待ってから確かめる
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(answerBox()).toHaveValue('食べる')
  })
})

it('記録の保存に失敗したら、そう伝えてもう一度保存できる', async () => {
  const user = userEvent.setup()
  render(
    <App
      repository={createMemoryStudySetRepository([sample()], { failRecord: true })}
      auth={signedIn()}
      notes={createMemoryScratchNoteRepository()}
    />,
  )
  await start(user, 'テストモード')
  for (const answer of ['食べる', '行く']) {
    await user.type(answerBox(), `${answer}{Enter}`)
    await user.click(screen.getByRole('button', { name: /次へ/ }))
  }
  expect(await screen.findByText(/記録を保存できませんでした/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'もう一度保存する' })).toBeInTheDocument()
})
