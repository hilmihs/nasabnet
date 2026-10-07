import { createContext, useContext } from 'react'
import type { Category } from './types'

export type ProfileTab = 'keluarga' | 'bio'

export type View = 'kabilah' | 'nikah' | 'relasi' | 'silsilah' | 'glosarium' | 'tersimpan'

export interface Route {
  view: View
  params: Record<string, string>
}

export interface UI {
  route: Route
  go: (view: View, params?: Record<string, string>) => void
  openProfile: (id: string, tab?: ProfileTab) => void
  filters: Category[]
  setFilters: (c: Category[]) => void
}

export const UIContext = createContext<UI | null>(null)

export function useUI(): UI {
  const u = useContext(UIContext)
  if (!u) throw new Error('UIContext missing')
  return u
}

export function parseHash(hash: string): Route {
  const [path, qs] = hash.replace(/^#\/?/, '').split('?')
  const views: View[] = ['kabilah', 'nikah', 'relasi', 'silsilah', 'glosarium', 'tersimpan']
  const view = (views.includes(path as View) ? path : 'kabilah') as View
  return { view, params: Object.fromEntries(new URLSearchParams(qs ?? '')) }
}

export function toHash(view: View, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
  return `#/${view}${qs ? `?${qs}` : ''}`
}
