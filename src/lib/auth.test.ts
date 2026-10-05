import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './auth'

describe('authErrorMessage', () => {
  it('知っているエラーコードは日本語の説明にする', () => {
    expect(authErrorMessage('invalid_credentials', 'x')).toBe('メールアドレスかパスワードが違います')
  })

  it('知らないコードや、コードがないときは代わりの文を使う', () => {
    expect(authErrorMessage('something_new', '登録できませんでした')).toBe('登録できませんでした')
    expect(authErrorMessage(undefined, 'ログインできませんでした')).toBe('ログインできませんでした')
  })
})
