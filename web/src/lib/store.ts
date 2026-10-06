import { useCallback, useEffect, useState } from 'react'

export type SavedKind = 'person' | 'path' | 'lineage' | 'tribe'

export interface SavedItem {
  kind: SavedKind
  /** person id, tribe id, or "a|b" for a path */
  ref: string
  label: string
  at: number
}

const KEYS = { history: 'nasabnet.history.v1', bookmarks: 'nasabnet.bookmarks.v1' }
const MAX_HISTORY = 60

function read(key: string): SavedItem[] {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as SavedItem[]) : []
  } catch {
    return []
  }
}

function write(key: string, items: SavedItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // storage unavailable (private mode / blocked) — keep in-memory only
  }
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const same = (a: SavedItem, b: Pick<SavedItem, 'kind' | 'ref'>) => a.kind === b.kind && a.ref === b.ref

export function pushHistory(item: Omit<SavedItem, 'at'>) {
  const list = read(KEYS.history).filter((x) => !same(x, item))
  list.unshift({ ...item, at: Date.now() })
  write(KEYS.history, list.slice(0, MAX_HISTORY))
  emit()
}

export function toggleBookmark(item: Omit<SavedItem, 'at'>) {
  const list = read(KEYS.bookmarks)
  const exists = list.some((x) => same(x, item))
  write(KEYS.bookmarks, exists ? list.filter((x) => !same(x, item)) : [{ ...item, at: Date.now() }, ...list])
  emit()
}

export function clearHistory() {
  write(KEYS.history, [])
  emit()
}

export function useSaved() {
  const [state, setState] = useState(() => ({ history: read(KEYS.history), bookmarks: read(KEYS.bookmarks) }))
  useEffect(() => {
    const l = () => setState({ history: read(KEYS.history), bookmarks: read(KEYS.bookmarks) })
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  const isBookmarked = useCallback(
    (kind: SavedKind, ref: string) => state.bookmarks.some((x) => x.kind === kind && x.ref === ref),
    [state.bookmarks],
  )
  return { ...state, isBookmarked }
}
