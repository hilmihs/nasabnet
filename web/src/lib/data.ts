import { createContext, useContext } from 'react'
import { isArabic, normAr, normLat } from './arabic'
import { buildGraph, type Graph } from './graph'
import type { Category, Dataset, Person, Tribe } from './types'

const PALETTE: Record<Tribe['group'], string[]> = {
  quraisy: ['#0f3b2e', '#1d6a54', '#2b8569', '#3f9c7d', '#155040', '#4c7a3a', '#2f5d50', '#5d8f6e', '#0b5d4b', '#367a5f', '#21614a', '#4a8a72', '#1a4d3c', '#6aa38a', '#0d4636'],
  anshar: ['#a8841b', '#c49b2a', '#8a6a12'],
  arab: ['#7a5c3a', '#946f45', '#6b5b3e', '#a1784d', '#5f4a30', '#8c6a4f', '#b08a5a', '#73563c'],
  ajam: ['#5a6b78', '#6f8290', '#4a5966'],
}

export interface SearchHit {
  kind: 'person' | 'tribe'
  id: string
  score: number
}

export interface Store {
  g: Graph
  tribes: Map<string, Tribe>
  membersByTribe: Map<string, Person[]>
  search: (q: string, opts?: { limit?: number; kinds?: SearchHit['kind'][]; cats?: Category[] }) => SearchHit[]
  /** importance used to rank people (degree + companion + category bonus) */
  weight: (id: string) => number
  /** stable colour per tribe (by group palette) */
  colorOf: (p?: Person) => string
  tribeColorById: (tribeId?: string) => string
}

export async function loadStore(): Promise<Store> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/nasabnet.json`)
  if (!res.ok) throw new Error(`Gagal memuat data (${res.status})`)
  const data = (await res.json()) as Dataset
  return makeStore(data)
}

export function makeStore(data: Dataset): Store {
  const g = buildGraph(data)
  const tribes = new Map(data.tribes.map((t) => [t.id, t]))
  const membersByTribe = new Map<string, Person[]>()
  for (const p of data.persons) {
    if (!p.tribe) continue
    let l = membersByTribe.get(p.tribe)
    if (!l) membersByTribe.set(p.tribe, (l = []))
    l.push(p)
  }

  const weights = new Map<string, number>()
  for (const p of data.persons) {
    const deg = g.adj.get(p.id)?.length ?? 0
    const bonus = (p.comp ? 6 : 0) + p.cats.length * 4 + (p.id === 'nabi' ? 1000 : 0)
    weights.set(p.id, deg + bonus)
  }
  const weight = (id: string) => weights.get(id) ?? 0
  for (const l of membersByTribe.values()) l.sort((a, b) => weight(b.id) - weight(a.id))

  const index = data.persons.map((p) => ({
    id: p.id,
    ar: normAr([p.ar, p.full, p.kunya, p.laqab].filter(Boolean).join(' | ')),
    lat: normLat(p.lat),
  }))
  const tIndex = data.tribes.map((t) => ({ id: t.id, ar: normAr(t.ar), lat: normLat(`${t.name} ${t.id}`) }))

  const search: Store['search'] = (q, opts = {}) => {
    const limit = opts.limit ?? 20
    const kinds = opts.kinds ?? ['person', 'tribe']
    const ar = isArabic(q)
    const nq = ar ? normAr(q) : normLat(q)
    if (!nq) return []
    const terms = nq.split(' ')
    const hits: SearchHit[] = []
    const scoreOf = (hay: string) => {
      if (!terms.every((t) => hay.includes(t))) return 0
      let s = 1
      if (hay.startsWith(nq)) s += 20
      else if (hay.includes(`| ${nq}`)) s += 14
      else if (hay.startsWith(terms[0])) s += 6
      // shorter haystacks = closer match ("Ali bin Abi Thalib" beats "Fathimah binti al-Husain bin Ali…")
      s -= Math.min(8, Math.max(0, hay.split('|')[0].length - nq.length) / 6)
      return s
    }
    if (kinds.includes('tribe'))
      for (const t of tIndex) {
        const s = scoreOf(ar ? t.ar : t.lat)
        if (s) hits.push({ kind: 'tribe', id: t.id, score: s + 8 })
      }
    if (kinds.includes('person'))
      for (const p of index) {
        const s = scoreOf(ar ? p.ar : p.lat)
        if (!s) continue
        if (opts.cats?.length) {
          const person = g.byId.get(p.id)!
          if (!opts.cats.some((c) => person.cats.includes(c))) continue
        }
        hits.push({ kind: 'person', id: p.id, score: s + Math.log2(2 + weight(p.id)) })
      }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  const tColor = new Map<string, string>()
  const counters: Partial<Record<Tribe['group'], number>> = {}
  for (const t of data.tribes) {
    const i = (counters[t.group] = (counters[t.group] ?? -1) + 1)
    const pal = PALETTE[t.group] ?? PALETTE.arab
    tColor.set(t.id, pal[i % pal.length])
  }
  const tribeColorById = (tid?: string) => (tid && tColor.get(tid)) || '#9aa59f'
  const colorOf = (p?: Person) => tribeColorById(p?.tribe)

  return { g, tribes, membersByTribe, search, weight, colorOf, tribeColorById }
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('StoreContext missing')
  return s
}
