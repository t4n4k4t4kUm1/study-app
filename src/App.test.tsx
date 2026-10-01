// 仕様書 3.1 の受入基準を、画面の操作として確かめるテスト。
// 保存先はメモリ上の実装に差し替えるので、Supabase がなくても動く。
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryItemRepository } from './lib/itemRepository'

beforeEach(() => localStorage.clear())

describe('覚えたいことを保存する', () => {
  it('用語を入れて保存すると、一覧の先頭に出る', async () => {
    const user = userEvent.setup()
    render(<App repository={createMemoryItemRepository()} />)
    await screen.findByText(/まだ何も保存していません/)

    await user.type(screen.getByLabelText('用語'), '固有値')
    await user.type(screen.getByLabelText('科目'), '線形代数')
    await user.click(screen.getByRole('button', { name: '保存' }))

    const list = await screen.findByRole('list', { name: '保存した項目' })
    const first = within(list).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('固有値')
    expect(first).toHaveTextContent('線形代数')
    expect(first).toHaveTextContent('説明が未入力')
  })

  it('保存後は用語欄が空になり、科目は残る（続けて入力できる）', async () => {
    const user = userEvent.setup()
    render(<App repository={createMemoryItemRepository()} />)
    await screen.findByText(/まだ何も保存していません/)

    await user.type(screen.getByLabelText('用語'), '行列式')
    await user.type(screen.getByLabelText('科目'), '線形代数')
    await user.keyboard('{Enter}')

    await screen.findByText('行列式')
    expect(screen.getByLabelText('用語')).toHaveValue('')
    expect(screen.getByLabelText('科目')).toHaveValue('線形代数')
    expect(screen.getByLabelText('用語')).toHaveFocus()
  })

  it('同じ科目に同じ用語は保存せず、理由を伝える', async () => {
    const user = userEvent.setup()
    render(<App repository={createMemoryItemRepository()} />)
    await screen.findByText(/まだ何も保存していません/)

    // 1回目に入れた科目は保存後も残るので、2回目は用語だけ入れる
    await user.type(screen.getByLabelText('科目'), '韓国語')
    for (let i = 0; i < 2; i++) {
      await user.type(screen.getByLabelText('用語'), '먹다')
      await user.click(screen.getByRole('button', { name: '保存' }))
    }
    expect(await screen.findByRole('alert')).toHaveTextContent('すでに同じ用語が登録されています')
    expect(screen.getAllByText('먹다')).toHaveLength(1)
  })

  it('用語が空のあいだは保存ボタンを押せない', async () => {
    render(<App repository={createMemoryItemRepository()} />)
    await screen.findByText(/まだ何も保存していません/)
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('保存先が未設定なら、設定方法を表示する', () => {
    render(<App repository={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent('保存先（Supabase）が設定されていません')
  })
})
