import { useCallback, useEffect, useMemo, useState } from 'react'
import { ItemForm } from './components/ItemForm'
import { ItemList } from './components/ItemList'
import { parseItemInput, recentSubjects, type Item, type ItemInput } from './lib/items'
import { DuplicateItemError, type ItemRepository } from './lib/itemRepository'
import { loadLastSubject, saveLastSubject } from './lib/lastSubject'

type Props = { repository: ItemRepository | null }

export default function App({ repository }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const subjects = useMemo(() => recentSubjects(items), [items])

  useEffect(() => {
    if (!repository) return
    repository
      .list()
      .then(setItems)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }, [repository])

  const handleSave = useCallback(
    async (input: ItemInput) => {
      if (!repository) return { ok: false as const, error: '保存先が設定されていません' }
      const parsed = parseItemInput(input)
      if (!parsed.ok) return parsed
      try {
        const saved = await repository.add(parsed.value)
        setItems((prev) => [saved, ...prev])
        setHighlightId(saved.id)
        saveLastSubject(saved.subject)
        return { ok: true as const }
      } catch (e) {
        if (e instanceof DuplicateItemError) return { ok: false as const, error: e.message }
        return { ok: false as const, error: e instanceof Error ? e.message : '保存に失敗しました' }
      }
    },
    [repository],
  )

  return (
    <div className="app">
      <header>
        <h1>覚えたいこと</h1>
        <p className="tagline">出会ったらすぐ保存。あとで自分で問題にする。</p>
      </header>

      {!repository ? (
        <section className="setup" role="alert">
          <h2>保存先（Supabase）が設定されていません</h2>
          <p>
            環境変数 <code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> を設定してください。
            手順は README.md にあります。
          </p>
        </section>
      ) : (
        <>
          <ItemForm initialSubject={loadLastSubject()} subjects={subjects} onSave={handleSave} />
          <section>
            <h2 className="list-title">保存したこと{!loading && <span className="count">{items.length}件</span>}</h2>
            {loadError && (
              <p className="error" role="alert">
                {loadError}
              </p>
            )}
            {loading ? <p className="empty">読み込み中…</p> : <ItemList items={items} highlightId={highlightId} />}
          </section>
        </>
      )}
    </div>
  )
}
