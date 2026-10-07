import { normAr } from './arabic'
import { findPath, inLaws, kinshipTerm, relIds, siblings, type Graph } from './graph'
import type { Person } from './types'

/** One generation in a patrilineal chain, from the person upward. */
export interface Rung {
  ar: string
  id?: string
}

/** [self, father, grandfather, …] with the display/own name first. */
export function chainOf(p: Person): Rung[] {
  const ism = (p.full ?? p.ar).split(/[:،,]|\s+بن(?:ت)?\s/)[0].trim()
  return [{ ar: ism, id: p.id }, ...p.line.map((l) => ({ ar: l.ar, id: l.id }))]
}

/** Ancestor identity = its name + its father's name (normalised), so homonyms like "عمرو" do not merge. */
const rungKey = (c: Rung[], i: number) => `${normAr(c[i].ar)}|${c[i + 1] ? normAr(c[i + 1].ar) : ''}`

export interface AncestorIndex {
  /** ancestor key → people descending from it, with their generation distance */
  byKey: Map<string, { id: string; up: number }[]>
}

export function buildAncestorIndex(persons: Person[]): AncestorIndex {
  const byKey = new Map<string, { id: string; up: number }[]>()
  for (const p of persons) {
    const c = chainOf(p)
    for (let i = 1; i < c.length; i++) {
      const k = rungKey(c, i)
      let l = byKey.get(k)
      if (!l) byKey.set(k, (l = []))
      l.push({ id: p.id, up: i })
    }
  }
  return { byKey }
}

export interface Meeting {
  /** the shared ancestor rung */
  ancestor: Rung
  upA: number
  upB: number
  /** from the ancestor's child down to A (inclusive) */
  branchA: Rung[]
  branchB: Rung[]
}

/** Nearest shared patrilineal ancestor of a and b, with both descending branches. */
export function meetingPoint(a: Person, b: Person): Meeting | null {
  const ca = chainOf(a)
  const cb = chainOf(b)
  // a is a direct ancestor of b (or the reverse)
  const ia = cb.findIndex((r) => r.id === a.id)
  if (ia > 0) return { ancestor: ca[0], upA: 0, upB: ia, branchA: [], branchB: cb.slice(0, ia).reverse() }
  const ib = ca.findIndex((r) => r.id === b.id)
  if (ib > 0) return { ancestor: cb[0], upA: ib, upB: 0, branchA: ca.slice(0, ib).reverse(), branchB: [] }
  const kb = new Map<string, number>()
  for (let j = 1; j < cb.length; j++) {
    kb.set(rungKey(cb, j), j)
    if (cb[j].id) kb.set(`#${cb[j].id}`, j)
  }
  for (let i = 1; i < ca.length; i++) {
    // ids are the strongest match; then name + father's name (the topmost rung may lack a father)
    const byId = ca[i].id ? kb.get(`#${ca[i].id}`) : undefined
    const j = byId ?? kb.get(rungKey(ca, i))
    if (j !== undefined)
      return { ancestor: ca[i].id ? ca[i] : cb[j], upA: i, upB: j, branchA: ca.slice(0, i).reverse(), branchB: cb.slice(0, j).reverse() }
  }
  return null
}

/** Indonesian label for two people meeting at a common patrilineal ancestor. */
export function nasabLabel(upSelf: number, upOther: number, other?: Person): string {
  const f = other?.g === 'f'
  if (upSelf === 1 && upOther === 1) return f ? 'saudari seayah' : 'saudara seayah'
  if (upSelf === 2 && upOther === 2) return f ? 'sepupu perempuan' : 'sepupu'
  if (upSelf === 2 && upOther === 1) return f ? "bibi ('ammah)" : "paman ('amm)"
  if (upSelf === 1 && upOther === 2) return f ? 'keponakan perempuan' : 'keponakan'
  if (upSelf === 3 && upOther === 3) return 'sepupu dua kali'
  if (upSelf === 3 && upOther === 1) return f ? 'saudari kakek' : 'saudara kakek'
  if (upSelf === 2 && upOther === 3) return f ? 'anak perempuan sepupu' : 'anak sepupu'
  if (upSelf === 3 && upOther === 2) return f ? 'sepupu perempuan ayah' : 'sepupu ayah'
  if (upSelf === 1 && upOther === 3) return f ? 'cucu perempuan saudara' : 'cucu saudara'
  if (upSelf === 3 && upOther === 4) return f ? 'anak perempuan sepupu dua kali' : 'anak sepupu dua kali'
  if (upSelf === 4 && upOther === 4) return 'sepupu tiga kali'
  if (upSelf === upOther) return `kerabat se-nasab (bertemu ${upSelf} generasi ke atas)`
  return upSelf > upOther ? `kerabat generasi di atasnya (${upSelf}/${upOther} generasi)` : `kerabat generasi di bawahnya (${upSelf}/${upOther} generasi)`
}

export interface NasabKin {
  id: string
  ancestor: string
  upSelf: number
  upOther: number
  label: string
}

/** People who share a patrilineal ancestor with `p` within `maxUp` generations (nearest ancestor wins). */
export function nasabRelatives(g: Graph, idx: AncestorIndex, p: Person, maxUp = 4, limit = 60, onlyCompanions = true): NasabKin[] {
  const c = chainOf(p)
  const seen = new Set<string>([p.id])
  const out: NasabKin[] = []
  for (let i = 1; i < Math.min(c.length, maxUp + 1); i++) {
    const list = idx.byKey.get(rungKey(c, i)) ?? []
    for (const { id, up } of list) {
      if (seen.has(id) || up > maxUp + 1) continue
      const o = g.byId.get(id)
      if (!o || (onlyCompanions && !o.comp)) continue
      // skip direct ancestors/descendants: they are not "side" kin
      if (c.some((r) => r.id === id) || o.line.some((l) => l.id === p.id)) continue
      seen.add(id)
      out.push({ id, ancestor: c[i].ar, upSelf: i, upOther: up, label: nasabLabel(i, up, o) })
    }
  }
  return out.sort((a, b) => a.upSelf + a.upOther - (b.upSelf + b.upOther)).slice(0, limit)
}

export interface KinLink {
  id: string
  label: string
}

/** Family within two hops (blood + marriage), named with Indonesian kinship terms. */
export function familyRelatives(g: Graph, id: string): KinLink[] {
  const ring = new Set<string>()
  const add = (xs: string[]) => xs.forEach((x) => x !== id && ring.add(x))
  add(relIds(g, id, 'parent', 'child', 'spouse'))
  add(siblings(g, id))
  const law = inLaws(g, id)
  add([...law.parentsInLaw, ...law.childrenInLaw, ...law.siblingsInLaw, ...law.coInLaws])
  for (const p of relIds(g, id, 'parent')) {
    add(relIds(g, p, 'parent'))
    add(siblings(g, p))
  }
  for (const c of relIds(g, id, 'child')) add(relIds(g, c, 'child'))
  const out: KinLink[] = []
  for (const x of ring) {
    const path = findPath(g, id, x, { maxDepth: 4 })
    if (!path) continue
    out.push({ id: x, label: kinshipTerm(g, path) ?? `kerabat (${path.length} langkah)` })
  }
  return out
}

export interface Alliance {
  tribe: string
  links: { via: string; other: string; relation: string }[]
}

/**
 * Tribal alliances around a person: people of other tribes bound to the person's close family by
 * marriage, mu'akhah, or wala' — grouped by their tribe.
 */
export function allianceRelatives(g: Graph, id: string): Alliance[] {
  const p = g.byId.get(id)
  if (!p) return []
  const family = new Set<string>([id, ...relIds(g, id, 'parent', 'child'), ...siblings(g, id)])
  const groups = new Map<string, Alliance['links']>()
  const push = (tribe: string | undefined, link: Alliance['links'][number]) => {
    if (!tribe || tribe === p.tribe) return
    let l = groups.get(tribe)
    if (!l) groups.set(tribe, (l = []))
    if (!l.some((x) => x.other === link.other)) l.push(link)
  }
  for (const f of family) {
    for (const s of relIds(g, f, 'spouse')) push(g.byId.get(s)?.tribe, { via: f, other: s, relation: f === id ? 'pasangan' : 'pasangan keluarga dekat' })
  }
  for (const m of relIds(g, id, 'muakhah')) push(g.byId.get(m)?.tribe, { via: id, other: m, relation: "mu'akhah" })
  for (const m of relIds(g, id, 'patron', 'client')) push(g.byId.get(m)?.tribe, { via: id, other: m, relation: "wala'" })
  return [...groups.entries()].map(([tribe, links]) => ({ tribe, links })).sort((a, b) => b.links.length - a.links.length)
}
