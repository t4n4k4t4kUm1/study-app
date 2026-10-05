// ログインまわりの窓口。画面はこの AuthClient だけを使う（データのリポジトリと同じ考え方）。
// 本番は Supabase Auth、テストはメモリ上の偽物に差し替える。
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/** ログイン中の人 */
export type Session = { userId: string; email: string }

export interface AuthClient {
  /** 今ログインしているか（起動直後に1回聞く） */
  getSession(): Promise<Session | null>
  /** ログイン・ログアウトが起きたら知らせてもらう。戻り値を呼ぶと知らせが止まる */
  onChange(listener: (session: Session | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  /** confirmationRequired：確認メールのリンクを開くまでログインできない設定のとき true */
  signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }>
  signOut(): Promise<void>
}

// Supabase のエラーコード → 日本語の説明
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'メールアドレスかパスワードが違います',
  user_already_exists: 'このメールアドレスはすでに登録されています。ログインしてください',
  email_not_confirmed: '確認メールのリンクを開いてから、もう一度ログインしてください',
  weak_password: 'パスワードが弱すぎます。もっと長く、推測されにくいものにしてください',
  email_address_invalid: 'メールアドレスの形が正しくありません',
  email_address_not_authorized: 'このメールアドレスには確認メールを送れません（README の Supabase 設定を見てください）',
  over_email_send_rate_limit: 'メールの送信回数の上限に達しました。しばらく待ってからやり直してください',
  over_request_rate_limit: '操作が多すぎます。しばらく待ってからやり直してください',
  signup_disabled: '新規登録は受け付けていません',
}

export function authErrorMessage(code: string | undefined, fallback: string): string {
  return (code && MESSAGES[code]) || fallback
}

function toSession(raw: { user: { id: string; email?: string } } | null): Session | null {
  return raw ? { userId: raw.user.id, email: raw.user.email ?? '' } : null
}

export function createSupabaseAuth(client: SupabaseClient<Database>): AuthClient {
  return {
    async getSession() {
      const { data } = await client.auth.getSession()
      return toSession(data.session)
    },
    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(toSession(session)))
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw new Error(authErrorMessage(error.code, `ログインできませんでした: ${error.message}`))
    },
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password })
      if (error) throw new Error(authErrorMessage(error.code, `登録できませんでした: ${error.message}`))
      return { confirmationRequired: data.session === null }
    },
    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) throw new Error(`ログアウトできませんでした: ${error.message}`)
    },
  }
}

/** テスト用：メモリ上の偽物。users はメールアドレス → パスワード */
export function createMemoryAuth(
  options: { users?: Record<string, string>; session?: Session | null; confirmationRequired?: boolean } = {},
): AuthClient {
  const users = { ...options.users }
  let current = options.session ?? null
  const listeners = new Set<(s: Session | null) => void>()
  const set = (s: Session | null) => {
    current = s
    listeners.forEach((l) => l(s))
  }
  return {
    async getSession() {
      return current
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async signIn(email, password) {
      if (users[email] !== password) throw new Error(authErrorMessage('invalid_credentials', ''))
      set({ userId: `user-${email}`, email })
    },
    async signUp(email, password) {
      if (email in users) throw new Error(authErrorMessage('user_already_exists', ''))
      users[email] = password
      if (options.confirmationRequired) return { confirmationRequired: true }
      set({ userId: `user-${email}`, email })
      return { confirmationRequired: false }
    },
    async signOut() {
      set(null)
    },
  }
}
