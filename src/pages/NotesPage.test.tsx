// 掃きだめメモの画面を、操作として確かめるテスト。自動保存の待ち時間は短くしてある。
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mergeBodies } from '../lib/scratchNote'
import { createMemoryScratchNoteRepository } from '../lib/scratchNoteRepository'
import { NotesPage } from './NotesPage'

const DELAY = 30
const memo = () => screen.getByLabelText('掃きだめメモ')

describe('掃きだめメモ', () => {
  it('前回の内容が出て、書くのをやめると自動で保存される', async () => {
    const user = userEvent.setup()
    const notes = createMemoryScratchNoteRepository({
      body: '前回のメモ',
      updatedAt: '2026-10-05T08:00:00.000001+00:00',
    })
    render(<NotesPage notes={notes} autosaveDelayMs={DELAY} />)

    expect(await screen.findByDisplayValue('前回のメモ')).toBeInTheDocument()
    expect(memo()).toHaveFocus()
    expect((memo() as HTMLTextAreaElement).selectionStart).toBe('前回のメモ'.length) // カーソルは最後
    await user.type(memo(), '\n固有値は det(A − λI) = 0 の解')
    expect(screen.getByRole('status')).toHaveTextContent('未保存の変更があります')

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('保存しました'))
    expect(notes.current().body).toBe('前回のメモ\n固有値は det(A − λI) = 0 の解')
  })

  it('Ctrl+S ですぐ保存できる', async () => {
    const user = userEvent.setup()
    const notes = createMemoryScratchNoteRepository()
    render(<NotesPage notes={notes} autosaveDelayMs={60_000} />) // 自動保存は来ないくらい長くする

    await user.type(await screen.findByLabelText('掃きだめメモ'), 'すぐ保存')
    await user.keyboard('{Control>}s{/Control}')
    await waitFor(() => expect(notes.current().body).toBe('すぐ保存'))
  })

  it('ほかの端末で先に保存されていたら上書きせず、「両方残す」で両方の内容を残す', async () => {
    const user = userEvent.setup()
    const notes = createMemoryScratchNoteRepository()
    render(<NotesPage notes={notes} autosaveDelayMs={DELAY} />)
    await screen.findByLabelText('掃きだめメモ')

    notes.otherDevice('ノートPCで書いた') // この端末が読み込んだあとに、ほかの端末が保存した
    await user.type(memo(), 'デスクトップで書いた')

    expect(await screen.findByRole('alert')).toHaveTextContent('ほかの端末でこのメモが更新されていました')
    expect(notes.current().body).toBe('ノートPCで書いた') // まだ上書きされていない

    await user.click(screen.getByRole('button', { name: '両方残す' }))
    await waitFor(() => expect(notes.current().body).toContain('デスクトップで書いた'))
    expect(notes.current().body).toBe('ノートPCで書いたデスクトップで書いた') // どちらも空の後ろに足しただけなので、つなげる
    expect(memo()).toHaveValue(notes.current().body)
  })

  it('「この端末の内容で上書きする」を選ぶと、この端末の内容だけになる', async () => {
    const user = userEvent.setup()
    const notes = createMemoryScratchNoteRepository()
    render(<NotesPage notes={notes} autosaveDelayMs={DELAY} />)
    await screen.findByLabelText('掃きだめメモ')

    notes.otherDevice('古い内容')
    await user.type(memo(), '新しい内容')
    await user.click(await screen.findByRole('button', { name: 'この端末の内容で上書きする' }))
    await waitFor(() => expect(notes.current().body).toBe('新しい内容'))
  })
})

describe('mergeBodies', () => {
  const now = new Date('2026-10-05T08:30:00Z') // 日本時間 17:30

  it('両方とも後ろに書き足しただけなら、両方の追記をつなげる', () => {
    expect(mergeBodies('共通\n', '共通\nノートPC\n', '共通\nデスクトップ', now)).toBe('共通\nノートPC\nデスクトップ')
  })

  it('途中を書き換えていたら、区切り線をはさんでこの端末の内容を丸ごと足す', () => {
    expect(mergeBodies('共通', '共通（直した）\n\n', 'デスクトップで全部書き直した', now)).toBe(
      '共通（直した）\n\n---- この端末で書いていた内容（10/5 17:30） ----\nデスクトップで全部書き直した',
    )
  })

  it('ほかの端末の内容が空になっていたら、区切り線から始める', () => {
    expect(mergeBodies('元', '', 'B', now)).toBe('---- この端末で書いていた内容（10/5 17:30） ----\nB')
  })
})
