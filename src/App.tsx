// 画面全体。ログインしていなければログイン画面を、していれば URL の # に合わせたページを出す。
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { pageVariants, spring } from './components/motion'
import { QuickMemo } from './components/QuickMemo'
import { APP_VERSION } from './lib/version'
import type { AuthClient, Session } from './lib/auth'
import { href, type Route } from './lib/router'
import type { ScratchNoteRepository } from './lib/scratchNoteRepository'
import type { StudySetRepository } from './lib/studySetRepository'
import { useHashRoute } from './lib/useHashRoute'
import { useSession } from './lib/useSession'
import { ChoicePage } from './pages/ChoicePage'
import { EditSetPage } from './pages/EditSetPage'
import { FlashcardsPage } from './pages/FlashcardsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MatchPage } from './pages/MatchPage'
import { NewSetPage } from './pages/NewSetPage'
import { NotesPage } from './pages/NotesPage'
import { SetPage } from './pages/SetPage'
import { TypingPage } from './pages/TypingPage'

type Props = {
  repository: StudySetRepository | null
  auth: AuthClient | null
  notes: ScratchNoteRepository | null
}

export default function App({ repository, auth, notes }: Props) {
  return (
    // reducedMotion="user"：OS で「動きを減らす」にしている人には、位置や大きさが変わる動きを止める
    <MotionConfig reducedMotion="user">
      <Backdrop />
      <div className="app">
        {repository && auth && notes ? (
          <Main repository={repository} auth={auth} notes={notes} />
        ) : (
          <>
            <Header session={null} route={null} />
            <main>
              <SetupNotice />
            </main>
          </>
        )}
        {/* 画面のいちばん下に、小さくバージョンを出す（どの版が公開されているかを確かめるため） */}
        <footer className="app-version">学習アプリ v{APP_VERSION}</footer>
      </div>
    </MotionConfig>
  )
}

// 背景：色のついた光の玉が、ゆっくり漂う（CSS のアニメーション。ガラスのパネル越しにぼんやり透ける）
function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <span className="orb orb-a" />
      <span className="orb orb-b" />
      <span className="orb orb-c" />
    </div>
  )
}

function Main({
  repository,
  auth,
  notes,
}: {
  repository: StudySetRepository
  auth: AuthClient
  notes: ScratchNoteRepository
}) {
  const route = useHashRoute()
  const session = useSession(auth)
  const signedIn = session.status === 'signedIn' ? session.session : null
  // 画面ごとの名札。これが変わると、前の画面が消えてから次の画面が出てくる
  const pageKey = signedIn ? `${signedIn.userId}:${routeKey(route)}` : session.status

  return (
    <>
      <Header session={signedIn} route={route} onSignOut={() => auth.signOut().catch(() => undefined)} />
      <main>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={pageKey} variants={pageVariants} initial="initial" animate="enter" exit="exit">
            {session.status === 'loading' && <p className="muted loading">読み込み中…</p>}
            {session.status === 'signedOut' && <LoginPage auth={auth} />}
            {signedIn && <Page route={route} repository={repository} notes={notes} />}
          </motion.div>
        </AnimatePresence>
      </main>
      {/* どの画面でも右下に「メモ」ボタン（メモの画面そのものでは出さない） */}
      {signedIn && route.name !== 'memo' && <QuickMemo key={signedIn.userId} notes={notes} />}
    </>
  )
}

function routeKey(route: Route): string {
  return 'id' in route ? `${route.name}/${route.id}` : route.name
}

// ヘッダー：すりガラスの帯。今いる場所のメニューの下に、光る札がすべって移動する
function Header({
  session,
  route,
  onSignOut,
}: {
  session: Session | null
  route: Route | null
  onSignOut?: () => void
}) {
  const section = route?.name === 'memo' ? 'memo' : 'sets'
  return (
    <header className="site-header">
      <a href="#/" className="brand">
        学習アプリ<span className="brand-sub">（仮称）</span>
      </a>
      {session && (
        <nav className="main-nav" aria-label="メニュー">
          <NavLink href={href({ name: 'home' })} active={section === 'sets'}>
            学習セット
          </NavLink>
          <NavLink href={href({ name: 'memo' })} active={section === 'memo'}>
            メモ
          </NavLink>
        </nav>
      )}
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

function NavLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <a href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
      {/* layoutId が同じ部品は、別の場所に出ても「同じもの」として、前の位置からすべって移動する */}
      {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={spring} />}
      <span className="nav-label">{children}</span>
    </a>
  )
}

function Page({
  route,
  repository,
  notes,
}: {
  route: Route
  repository: StudySetRepository
  notes: ScratchNoteRepository
}) {
  switch (route.name) {
    case 'home':
      return <HomePage repository={repository} />
    case 'new':
      return <NewSetPage repository={repository} />
    case 'memo':
      return <NotesPage notes={notes} />
    case 'set':
      return <SetPage repository={repository} id={route.id} />
    case 'cards':
      return <FlashcardsPage repository={repository} id={route.id} />
    case 'edit':
      return <EditSetPage repository={repository} id={route.id} />
    case 'typing':
      return <TypingPage repository={repository} id={route.id} />
    case 'choice':
      return <ChoicePage repository={repository} id={route.id} />
    case 'match':
      return <MatchPage repository={repository} id={route.id} />
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
