// ログインと新規登録の画面。ログインしていないときは、どの URL でもこの画面が出る。
import { useState, type FormEvent } from 'react'
import type { AuthClient } from '../lib/auth'

type Mode = 'signIn' | 'signUp'

export function LoginPage({ auth }: { auth: AuthClient }) {
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isSignUp = mode === 'signUp'

  function switchMode() {
    setMode(isSignUp ? 'signIn' : 'signUp')
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (email.trim() === '' || password === '') {
      setError('メールアドレスとパスワードを入力してください')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (isSignUp) {
        const { confirmationRequired } = await auth.signUp(email.trim(), password)
        if (confirmationRequired) setInfo('確認メールを送りました。メールのリンクを開いてから、ログインしてください。')
      } else {
        await auth.signIn(email.trim(), password)
      }
      // 成功するとログイン状態が変わり、App が自動でこの画面を閉じる
    } catch (err) {
      setError(err instanceof Error ? err.message : 'うまくいきませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login panel" onSubmit={handleSubmit} noValidate>
      <h1>{isSignUp ? 'アカウントを作る' : 'ログイン'}</h1>
      <p className="muted">学習セットは、作った本人だけが見たり編集したりできます。</p>
      <label className="field">
        メールアドレス
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
      </label>
      <label className="field">
        パスワード
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="info" role="status">
          {info}
        </p>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        {busy ? '送信中…' : isSignUp ? '登録する' : 'ログイン'}
      </button>
      <button type="button" className="link-button" onClick={switchMode}>
        {isSignUp ? 'アカウントをお持ちの方はログイン' : 'はじめての方はアカウントを作る'}
      </button>
    </form>
  )
}
