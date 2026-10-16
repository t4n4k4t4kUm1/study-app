// 画面全体。ログインしていなければログイン画面を、していれば URL の # に合わせたページを出す。
import { QuickMemo } from './components/QuickMemo'
import type { AuthClient, Session } from './lib/auth'
import type { BlackjackRepository } from './lib/blackjackRepository'
import type { CreditRepository } from './lib/creditRepository'
import { formatCredits } from './lib/credits'
import { href, type Route } from './lib/router'
import type { ScratchNoteRepository } from './lib/scratchNoteRepository'
import type { StudySetRepository } from './lib/studySetRepository'
import { useCreditBalance } from './lib/useCreditBalance'
import { useHashRoute } from './lib/useHashRoute'
import { useSession } from './lib/useSession'
import { BlackjackPage } from './pages/BlackjackPage'
import { EditSetPage } from './pages/EditSetPage'
import { FlashcardsPage } from './pages/FlashcardsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NewSetPage } from './pages/NewSetPage'
import { NotesPage } from './pages/NotesPage'
import { SetPage } from './pages/SetPage'
import { TypingPage } from './pages/TypingPage'

type Props = {
  repository: StudySetRepository | null
  auth: AuthClient | null
  notes: ScratchNoteRepository | null
  credits: CreditRepository | null
  casino: BlackjackRepository | null
}

export default function App({ repository, auth, notes, credits, casino }: Props) {
  return (
    <div className="app">
      {repository && auth && notes && credits && casino ? (
        <Main repository={repository} auth={auth} notes={notes} credits={credits} casino={casino} />
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

function Main({
  repository,
  auth,
  notes,
  credits,
  casino,
}: {
  repository: StudySetRepository
  auth: AuthClient
  notes: ScratchNoteRepository
  credits: CreditRepository
  casino: BlackjackRepository
}) {
  const route = useHashRoute()
  const session = useSession(auth)
  const balance = useCreditBalance(credits, session.status === 'signedIn' ? session.session.userId : null)
  return (
    <>
      <Header
        session={session.status === 'signedIn' ? session.session : null}
        credits={balance}
        onSignOut={() => auth.signOut().catch(() => undefined)}
      />
      <main>
        {session.status === 'loading' && <p className="muted">読み込み中…</p>}
        {session.status === 'signedOut' && <LoginPage auth={auth} />}
        {/* key にユーザーの id を渡すと、別の人がログインしたときに画面の状態がすべて作り直される */}
        {session.status === 'signedIn' && (
          <Page
            key={session.session.userId}
            route={route}
            repository={repository}
            notes={notes}
            casino={casino}
            balance={balance.balance}
            onCreditsChange={balance.refresh}
          />
        )}
      </main>
      {/* どの画面でも右下に「メモ」ボタン（メモの画面そのものでは出さない） */}
      {session.status === 'signedIn' && route.name !== 'memo' && (
        <QuickMemo key={session.session.userId} notes={notes} />
      )}
    </>
  )
}

type CreditDisplay = { balance: number | null; error: boolean }

function Header({
  session,
  credits,
  onSignOut,
}: {
  session: Session | null
  credits?: CreditDisplay
  onSignOut?: () => void
}) {
  return (
    <header className="site-header">
      <a href="#/" className="brand">
        学習アプリ<span className="brand-sub">（仮称）</span>
      </a>
      {session && (
        <nav className="main-nav" aria-label="メニュー">
          <a href={href({ name: 'home' })}>学習セット</a>
          <a href={href({ name: 'memo' })}>メモ</a>
          <a href={href({ name: 'blackjack' })}>カジノ</a>
        </nav>
      )}
      {session && (
        <div className="account">
          {credits && <CreditBalance {...credits} />}
          <span className="account-email">{session.email}</span>
          <button type="button" className="link-button" onClick={onSignOut}>
            ログアウト
          </button>
        </div>
      )}
    </header>
  )
}

// 右上の「所持クレジット」。読み込み中は「…」、読めなかったら「—」
function CreditBalance({ balance, error }: CreditDisplay) {
  const text = balance !== null ? formatCredits(balance) : error ? '—' : '…'
  return (
    <span className="credit-balance" title={error ? 'クレジットを読み込めませんでした' : '所持クレジット'}>
      <span className="coin" aria-hidden="true" />
      <span className="visually-hidden">所持クレジット </span>
      <span className="credit-amount">{text}</span>
    </span>
  )
}

function Page({
  route,
  repository,
  notes,
  casino,
  balance,
  onCreditsChange,
}: {
  route: Route
  repository: StudySetRepository
  notes: ScratchNoteRepository
  casino: BlackjackRepository
  balance: number | null
  onCreditsChange: () => void
}) {
  switch (route.name) {
    case 'home':
      return <HomePage repository={repository} />
    case 'new':
      return <NewSetPage repository={repository} />
    case 'memo':
      return <NotesPage notes={notes} />
    case 'blackjack':
      return <BlackjackPage casino={casino} balance={balance} onCreditsChange={onCreditsChange} />
    // key に id を渡すと、別のセットに移ったときにページの状態が作り直される
    case 'set':
      return <SetPage key={route.id} repository={repository} id={route.id} />
    case 'cards':
      return <FlashcardsPage key={route.id} repository={repository} id={route.id} />
    case 'edit':
      return <EditSetPage key={route.id} repository={repository} id={route.id} />
    case 'typing':
      return <TypingPage key={route.id} repository={repository} id={route.id} onCreditsChange={onCreditsChange} />
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
