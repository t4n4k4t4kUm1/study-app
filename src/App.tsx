// 画面全体。URL の # を見て、どのページを出すかを切り替える。
import type { Route } from './lib/router'
import type { StudySetRepository } from './lib/studySetRepository'
import { useHashRoute } from './lib/useHashRoute'
import { FlashcardsPage } from './pages/FlashcardsPage'
import { HomePage } from './pages/HomePage'
import { NewSetPage } from './pages/NewSetPage'
import { SetPage } from './pages/SetPage'

type Props = { repository: StudySetRepository | null }

export default function App({ repository }: Props) {
  const route = useHashRoute()
  return (
    <div className="app">
      <header className="site-header">
        <a href="#/" className="brand">
          学習アプリ<span className="brand-sub">（仮称）</span>
        </a>
      </header>
      <main>{repository ? <Page route={route} repository={repository} /> : <SetupNotice />}</main>
    </div>
  )
}

function Page({ route, repository }: { route: Route; repository: StudySetRepository }) {
  switch (route.name) {
    case 'home':
      return <HomePage repository={repository} />
    case 'new':
      return <NewSetPage repository={repository} />
    // key に id を渡すと、別のセットに移ったときにページの状態が作り直される
    case 'set':
      return <SetPage key={route.id} repository={repository} id={route.id} />
    case 'cards':
      return <FlashcardsPage key={route.id} repository={repository} id={route.id} />
    case 'notFound':
      return (
        <section className="notice">
          <h1>ページが見つかりません</h1>
          <a href="#/">学習セットの一覧へ</a>
        </section>
      )
  }
}

function SetupNotice() {
  return (
    <section className="notice" role="alert">
      <h1>保存先（Supabase）が設定されていません</h1>
      <p>
        環境変数 <code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> を設定してください。
        手順は README.md にあります。
      </p>
    </section>
  )
}
