// 画面全体。ログインしていなければログイン画面を、していれば URL の # に合わせたページを出す。
import type { AuthClient, Session } from './lib/auth'
import type { Route } from './lib/router'
import type { StudySetRepository } from './lib/studySetRepository'
import { useHashRoute } from './lib/useHashRoute'
import { useSession } from './lib/useSession'
import { EditSetPage } from './pages/EditSetPage'
import { FlashcardsPage } from './pages/FlashcardsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NewSetPage } from './pages/NewSetPage'
import { SetPage } from './pages/SetPage'
import { TypingPage } from './pages/TypingPage'

type Props = { repository: StudySetRepository | null; auth: AuthClient | null }

export default function App({ repository, auth }: Props) {
  return (
    <div className="app">
      {repository && auth ? (
        <Main repository={repository} auth={auth} />
      ) : (
        <>
          <Header session={null} />
          <main>
            <SetupNotice />
          </main>
        </>
      )}
    </div>
  )
}

function Main({ repository, auth }: { repository: StudySetRepository; auth: AuthClient }) {
  const route = useHashRoute()
  const session = useSession(auth)
  return (
    <>
      <Header
        session={session.status === 'signedIn' ? session.session : null}
        onSignOut={() => auth.signOut().catch(() => undefined)}
      />
      <main>
        {session.status === 'loading' && <p className="muted">読み込み中…</p>}
        {session.status === 'signedOut' && <LoginPage auth={auth} />}
        {/* key にユーザーの id を渡すと、別の人がログインしたときに画面の状態がすべて作り直される */}
        {session.status === 'signedIn' && <Page key={session.session.userId} route={route} repository={repository} />}
      </main>
    </>
  )
}

function Header({ session, onSignOut }: { session: Session | null; onSignOut?: () => void }) {
  return (
    <header className="site-header">
      <a href="#/" className="brand">
        学習アプリ<span className="brand-sub">（仮称）</span>
      </a>
      {session && (
        <div className="account">
          <span className="account-email">{session.email}</span>
          <button type="button" className="link-button" onClick={onSignOut}>
            ログアウト
          </button>
        </div>
      )}
    </header>
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
    case 'edit':
      return <EditSetPage key={route.id} repository={repository} id={route.id} />
    case 'typing':
      return <TypingPage key={route.id} repository={repository} id={route.id} />
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
