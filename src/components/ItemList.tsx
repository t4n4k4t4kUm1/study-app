import { timeAgo, type Item } from '../lib/items'

type Props = { items: Item[]; highlightId: string | null }

/** 保存した項目の一覧（新しい順） */
export function ItemList({ items, highlightId }: Props) {
  if (items.length === 0) {
    return <p className="empty">まだ何も保存していません。覚えたいことに出会ったら、上に入れて保存しましょう。</p>
  }
  return (
    <ul className="item-list" aria-label="保存した項目">
      {items.map((item) => (
        <li key={item.id} className={item.id === highlightId ? 'item new' : 'item'}>
          <div className="item-head">
            <span className="term">{item.term}</span>
            <span className="subject-chip">{item.subject === '' ? '未分類' : item.subject}</span>
          </div>
          {item.note ? <p className="note">{item.note}</p> : <p className="note missing">説明が未入力</p>}
          <div className="meta">
            {item.source && <span>{item.source}・</span>}
            <time dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
          </div>
        </li>
      ))}
    </ul>
  )
}
