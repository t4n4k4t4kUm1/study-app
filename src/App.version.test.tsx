// 画面のいちばん下にバージョンが出ることを確かめるテスト。
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'
import { createMemoryAuth } from './lib/auth'
import { createMemoryScratchNoteRepository } from './lib/scratchNoteRepository'
import { createMemoryStudySetRepository } from './lib/studySetRepository'
import { APP_VERSION } from './lib/version'

it('ログイン前も後も、画面の下にバージョンが出る', async () => {
  window.location.hash = ''
  const { unmount } = render(
    <App
      repository={createMemoryStudySetRepository()}
      auth={createMemoryAuth()}
      notes={createMemoryScratchNoteRepository()}
    />,
  )
  await screen.findByRole('heading', { name: 'ログイン' })
  expect(screen.getByRole('contentinfo')).toHaveTextContent(`学習アプリ v${APP_VERSION}`)
  unmount()

  render(
    <App
      repository={createMemoryStudySetRepository()}
      auth={createMemoryAuth({ session: { userId: 'u1', email: 'me@example.com' } })}
      notes={createMemoryScratchNoteRepository()}
    />,
  )
  await screen.findByRole('heading', { name: '学習セット' })
  expect(screen.getByRole('contentinfo')).toHaveTextContent(`v${APP_VERSION}`)
})

it('Supabase の設定がない画面でも出る', () => {
  render(<App repository={null} auth={null} notes={null} />)
  expect(screen.getByRole('contentinfo')).toHaveTextContent(`v${APP_VERSION}`)
})
