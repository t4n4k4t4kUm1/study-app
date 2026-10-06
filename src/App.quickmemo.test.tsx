// クイックメモ（右下の「メモ」ボタン）を、画面の操作として確かめるテスト。
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import { createMemoryScratchNoteRepository } from './lib/scratchNoteRepository'
import { createMemoryStudySetRepository } from './lib/studySetRepository'

const signedIn = () => createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })

beforeEach(() => {
  window.location.hash = ''
})

describe('クイックメモ', () => {
  it('どの画面でも右下のボタンで開き、閉じるとその場で保存される', async () => {
    const user = userEvent.setup()
    const notes = createMemoryScratchNoteRepository({ body: '前回のメモ', updatedAt: null })
    render(<App repository={createMemoryStudySetRepository()} auth={signedIn()} notes={notes} />)

    await user.click(await screen.findByRole('button', { name: 'メモを開く' }))
    const memo = await screen.findByLabelText('掃きだめメモ')
    expect(memo).toHaveValue('前回のメモ')
    expect(memo).toHaveFocus() // 開いたらすぐ書ける

    await user.type(memo, '\n学習中に思いついたこと')
    await user.click(screen.getByRole('button', { name: 'メモを閉じる' }))

    expect(screen.queryByLabelText('掃きだめメモ')).not.toBeInTheDocument()
    await waitFor(() => expect(notes.current().body).toBe('前回のメモ\n学習中に思いついたこと'))
    expect(screen.getByRole('button', { name: 'メモを開く' })).toHaveFocus() // カーソルはボタンに戻る
  })

  it('Esc で閉じられる', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createMemoryStudySetRepository()}
        auth={signedIn()}
        notes={createMemoryScratchNoteRepository()}
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'メモを開く' }))
    await screen.findByLabelText('掃きだめメモ')
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('掃きだめメモ')).not.toBeInTheDocument()
  })

  it('「大きく開く」でメモの画面へ移る。メモの画面ではボタンを出さない', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createMemoryStudySetRepository()}
        auth={signedIn()}
        notes={createMemoryScratchNoteRepository()}
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'メモを開く' }))
    await user.click(await screen.findByRole('link', { name: '大きく開く' }))

    expect(await screen.findByRole('heading', { name: '掃きだめメモ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'メモを開く' })).not.toBeInTheDocument()
  })

  it('ログインしていなければ出さない', async () => {
    render(
      <App
        repository={createMemoryStudySetRepository()}
        auth={createMemoryAuth()}
        notes={createMemoryScratchNoteRepository()}
      />,
    )
    await screen.findByRole('heading', { name: 'ログイン' })
    expect(screen.queryByRole('button', { name: 'メモを開く' })).not.toBeInTheDocument()
  })
})
