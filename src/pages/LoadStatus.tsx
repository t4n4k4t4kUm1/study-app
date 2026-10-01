// 学習セットを読み込んでいる途中・失敗・見つからないときの表示（各ページで共通）
import { href } from '../lib/router'
import type { LoadState } from '../lib/useStudySet'

export function LoadStatus({ state }: { state: Exclude<LoadState, { status: 'ready' }> }) {
  switch (state.status) {
    case 'loading':
      return <p className="muted">読み込み中…</p>
    case 'error':
      return (
        <p className="error" role="alert">
          {state.message}
        </p>
      )
    case 'notFound':
      return (
        <section className="notice">
          <h1>学習セットが見つかりません</h1>
          <a href={href({ name: 'home' })}>学習セットの一覧へ</a>
        </section>
      )
  }
}
