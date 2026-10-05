// 「今ログインしているか」を画面で使うためのフック。
// 起動直後は Supabase に聞いている途中なので loading。その後はログイン・ログアウトのたびに変わる。
import { useEffect, useState } from 'react'
import type { AuthClient, Session } from './auth'

export type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session }

const toState = (s: Session | null): SessionState => (s ? { status: 'signedIn', session: s } : { status: 'signedOut' })

export function useSession(auth: AuthClient): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    auth.getSession().then((s) => {
      if (!cancelled) setState(toState(s))
    })
    const stop = auth.onChange((s) => setState(toState(s)))
    return () => {
      cancelled = true
      stop()
    }
  }, [auth])

  return state
}
