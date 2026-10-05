// 画面の切り替え（ルーティング）。URL の # より後ろで、どの画面を出すかを決める。
//   #/                 学習セットの一覧
//   #/new              学習セットを作る
//   #/sets/<id>        学習セットの中身
//   #/sets/<id>/cards  カードで学ぶ
//   #/sets/<id>/edit   学習セットを編集
// # を使う方式（ハッシュルーティング）にしたのは、サーバー側の設定なしで
// 再読み込みやブックマークが効くから（Vercel で 404 にならない）。
// ライブラリ（react-router など）を足すほどの画面数ではないので、自前で十数行にしている。

export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'set'; id: string }
  | { name: 'cards'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'notFound' }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const SET_PATH = new RegExp(`^/sets/(${UUID})$`, 'i')
const CARDS_PATH = new RegExp(`^/sets/(${UUID})/cards$`, 'i')
const EDIT_PATH = new RegExp(`^/sets/(${UUID})/edit$`, 'i')

/** location.hash（例："#/sets/xxxx"）から画面を決める */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  if (path === '/') return { name: 'home' }
  if (path === '/new') return { name: 'new' }
  const set = SET_PATH.exec(path)
  if (set) return { name: 'set', id: set[1].toLowerCase() }
  const cards = CARDS_PATH.exec(path)
  if (cards) return { name: 'cards', id: cards[1].toLowerCase() }
  const edit = EDIT_PATH.exec(path)
  if (edit) return { name: 'edit', id: edit[1].toLowerCase() }
  return { name: 'notFound' }
}

/** 画面からリンク先の文字列を作る（parseRoute の逆） */
export function href(route: Exclude<Route, { name: 'notFound' }>): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'new':
      return '#/new'
    case 'set':
      return `#/sets/${route.id}`
    case 'cards':
      return `#/sets/${route.id}/cards`
    case 'edit':
      return `#/sets/${route.id}/edit`
  }
}
