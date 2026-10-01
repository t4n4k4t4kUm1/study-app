// URL の # が変わったら画面を描き直すためのフック。
// useSyncExternalStore は「React の外にある値（ここでは location.hash）」を購読する React 標準の仕組み。
import { useMemo, useSyncExternalStore } from 'react'
import { parseRoute, type Route } from './router'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parseRoute(hash), [hash])
}

export function navigate(to: string) {
  window.location.hash = to
}
