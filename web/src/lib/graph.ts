import type { Dataset, Edge, EdgeKind, Person } from './types'

/** Directed relation as seen from the source person: "target is my <rel>". */
export type Rel = 'parent' | 'child' | 'spouse' | 'sibling' | 'muakhah' | 'patron' | 'client' | 'milk'

export interface Hop {
  to: string
  rel: Rel
  edge: Edge
}

export interface Graph {
  byId: Map<string, Person>
  adj: Map<string, Hop[]>
  data: Dataset
}

export function buildGraph(data: Dataset): Graph {
  const byId = new Map(data.persons.map((p) => [p.id, p]))
  const adj = new Map<string, Hop[]>()
  const push = (a: string, h: Hop) => {
    if (!byId.has(a) || !byId.has(h.to)) return
    let l = adj.get(a)
    if (!l) adj.set(a, (l = []))
    if (!l.some((x) => x.to === h.to && x.rel === h.rel)) l.push(h)
  }
  for (const e of data.edges) {
    switch (e.k) {
      case 'parent':
        push(e.s, { to: e.t, rel: 'child', edge: e })
        push(e.t, { to: e.s, rel: 'parent', edge: e })
        break
      case 'mawla':
        push(e.s, { to: e.t, rel: 'client', edge: e })
        push(e.t, { to: e.s, rel: 'patron', edge: e })
        break
      default: {
        const rel: Rel = e.k === 'spouse' ? 'spouse' : e.k === 'sibling' ? 'sibling' : e.k === 'milk' ? 'milk' : 'muakhah'
        push(e.s, { to: e.t, rel, edge: e })
        push(e.t, { to: e.s, rel, edge: e })
      }
    }
  }
  return { byId, adj, data }
}

export const hops = (g: Graph, id: string, ...rels: Rel[]) =>
  (g.adj.get(id) ?? []).filter((h) => rels.length === 0 || rels.includes(h.rel))

export const relIds = (g: Graph, id: string, ...rels: Rel[]) => [...new Set(hops(g, id, ...rels).map((h) => h.to))]

/** Siblings including those implied by a shared parent. */
export function siblings(g: Graph, id: string): string[] {
  const out = new Set(relIds(g, id, 'sibling'))
  for (const p of relIds(g, id, 'parent')) for (const c of relIds(g, p, 'child')) if (c !== id) out.add(c)
  return [...out]
}

const word = (p: Person | undefined, m: string, f: string) => (p?.g === 'f' ? f : m)

/** Label for a single hop: what `to` is to `from`. */
export function hopLabel(g: Graph, h: Hop): string {
  const t = g.byId.get(h.to)
  switch (h.rel) {
    case 'parent':
      return word(t, 'ayah', 'ibu')
    case 'child':
      return word(t, 'putra', 'putri')
    case 'spouse':
      return word(t, 'suami', 'istri')
    case 'sibling':
      return word(t, 'saudara', 'saudari')
    case 'muakhah':
      return "saudara mu'akhah"
    case 'patron':
      return 'tuan (pemberi wala’)'
    case 'client':
      return word(t, 'maula', 'maulah')
    case 'milk':
      return word(t, 'saudara sepersusuan', 'saudari sepersusuan')
  }
}

/** Indonesian kinship term for a whole path: what the last person is to the first. */
export function kinshipTerm(g: Graph, path: Hop[]): string | null {
  const r = path.map((h) => (h.rel === 'milk' ? 'sibling' : h.rel)).join('>')
  const last = g.byId.get(path[path.length - 1]?.to ?? '')
  const viaFirst = g.byId.get(path[0]?.to ?? '')
  const w = (m: string, f: string) => word(last, m, f)
  const table: Record<string, string> = {
    parent: w('ayah', 'ibu'),
    child: w('putra', 'putri'),
    spouse: w('suami', 'istri'),
    sibling: w('saudara', 'saudari'),
    muakhah: "saudara mu'akhah (dipersaudarakan Nabi ﷺ)",
    patron: 'tuan / pemberi wala’',
    client: w('maula', 'maulah'),
    'parent>parent': w('kakek', 'nenek'),
    'parent>parent>parent': w('buyut (kakek ayah/ibu)', 'buyut (nenek ayah/ibu)'),
    'child>child': w('cucu', 'cucu perempuan'),
    'child>child>child': 'cicit',
    'parent>child': w('saudara (seayah/seibu)', 'saudari (seayah/seibu)'),
    'parent>sibling': viaFirst?.g === 'f' ? w('paman (khal, saudara ibu)', 'bibi (khalah, saudari ibu)') : w("paman ('amm, saudara ayah)", "bibi ('ammah, saudari ayah)"),
    'parent>parent>child': viaFirst?.g === 'f' ? w('paman (khal)', 'bibi (khalah)') : w("paman ('amm)", "bibi ('ammah)"),
    'sibling>child': w('keponakan', 'keponakan perempuan'),
    'parent>child>child': w('keponakan', 'keponakan perempuan'),
    'parent>sibling>child': w('sepupu', 'sepupu perempuan'),
    'parent>parent>child>child': w('sepupu', 'sepupu perempuan'),
    'spouse>parent': w('mertua (ayah mertua)', 'mertua (ibu mertua)'),
    'child>spouse': w('menantu', 'menantu perempuan'),
    'spouse>sibling': w('ipar', 'ipar perempuan'),
    'spouse>parent>child': w('ipar', 'ipar perempuan'),
    'sibling>spouse': w('ipar (suami saudari)', 'ipar (istri saudara)'),
    'parent>child>spouse': w('ipar', 'ipar perempuan'),
    'spouse>sibling>spouse': 'biras (sama-sama menikahi kakak-beradik)',
    'spouse>parent>child>spouse': 'biras (sama-sama menikahi kakak-beradik)',
    'sibling>spouse>sibling': 'ipar dari saudara',
    'child>spouse>parent': 'besan',
    'spouse>child': w('anak tiri', 'anak tiri perempuan'),
    'parent>spouse': w('ayah tiri', 'ibu tiri'),
    'spouse>spouse': 'sesama pasangan (dari satu orang yang sama)',
    'child>spouse>sibling': 'ipar dari anak',
    'spouse>parent>parent': w('kakek mertua', 'nenek mertua'),
    'child>child>spouse': w('suami cucu', 'istri cucu'),
    'spouse>sibling>child': w('keponakan dari pasangan', 'keponakan dari pasangan'),
    'sibling>child>spouse': w('suami keponakan', 'istri keponakan'),
    'parent>sibling>spouse': w('suami bibi', 'istri paman'),
  }
  return table[r] ?? null
}

/**
 * Shortest relationship path (BFS). Family links are preferred: mu'akhah and wala'
 * hops are only used if `social` is set.
 */
export function findPath(g: Graph, from: string, to: string, opts: { social?: boolean; maxDepth?: number } = {}): Hop[] | null {
  if (from === to) return []
  const allowed = new Set<Rel>(['parent', 'child', 'spouse', 'sibling', 'milk'])
  if (opts.social) for (const r of ['muakhah', 'patron', 'client'] as Rel[]) allowed.add(r)
  const maxDepth = opts.maxDepth ?? 10
  const prev = new Map<string, Hop & { from: string }>()
  const depth = new Map<string, number>([[from, 0]])
  let frontier = [from]
  while (frontier.length) {
    const next: string[] = []
    for (const id of frontier) {
      const d = depth.get(id)!
      if (d >= maxDepth) continue
      // explore blood/marriage before social links so ties break toward family
      const hs = (g.adj.get(id) ?? []).filter((h) => allowed.has(h.rel))
      for (const h of hs) {
        if (depth.has(h.to)) continue
        depth.set(h.to, d + 1)
        prev.set(h.to, { ...h, from: id })
        if (h.to === to) {
          const path: Hop[] = []
          let cur = to
          while (cur !== from) {
            const p = prev.get(cur)!
            path.unshift({ to: p.to, rel: p.rel, edge: p.edge })
            cur = p.from
          }
          return path
        }
        next.push(h.to)
      }
    }
    frontier = next
  }
  return null
}

/**
 * Patrilineal meeting point of two people: the nearest shared ancestor in both chains.
 * Ancestors are matched on (name, father's name) so homonyms like "عمرو" do not collide.
 */
export function commonAncestor(a: Person, b: Person): { name: string; upA: number; upB: number } | null {
  const ca = [a.full?.split(/\s+بن(?:ت)?\s+/)[0] ?? '', ...a.line.map((l) => l.ar)]
  const cb = [b.full?.split(/\s+بن(?:ت)?\s+/)[0] ?? '', ...b.line.map((l) => l.ar)]
  const key = (c: string[], i: number) => (i + 1 < c.length ? `${c[i]}|${c[i + 1]}` : `${c[i]}|`)
  const kb = new Map<string, number>()
  for (let j = 1; j < cb.length; j++) if (j + 1 < cb.length) kb.set(key(cb, j), j)
  for (let i = 1; i < ca.length; i++) {
    if (i + 1 >= ca.length) break
    const j = kb.get(key(ca, i))
    if (j !== undefined) return { name: ca[i], upA: i, upB: j }
  }
  return null
}

export interface InLaws {
  spouses: string[]
  parentsInLaw: string[]
  childrenInLaw: string[]
  siblingsInLaw: string[]
  coInLaws: string[]
}

/** Marriage-derived relatives of a person: mertua, menantu, ipar, besan. */
export function inLaws(g: Graph, id: string): InLaws {
  const spouses = relIds(g, id, 'spouse')
  const parentsInLaw = new Set<string>()
  const siblingsInLaw = new Set<string>()
  for (const s of spouses) {
    relIds(g, s, 'parent').forEach((x) => parentsInLaw.add(x))
    siblings(g, s).forEach((x) => x !== id && siblingsInLaw.add(x))
  }
  for (const sib of siblings(g, id)) relIds(g, sib, 'spouse').forEach((x) => x !== id && siblingsInLaw.add(x))
  const childrenInLaw = new Set<string>()
  const coInLaws = new Set<string>()
  for (const c of relIds(g, id, 'child'))
    for (const cs of relIds(g, c, 'spouse')) {
      childrenInLaw.add(cs)
      relIds(g, cs, 'parent').forEach((x) => x !== id && !spouses.includes(x) && coInLaws.add(x))
    }
  return {
    spouses,
    parentsInLaw: [...parentsInLaw],
    childrenInLaw: [...childrenInLaw],
    siblingsInLaw: [...siblingsInLaw],
    coInLaws: [...coInLaws],
  }
}

export const edgeKinds: EdgeKind[] = ['parent', 'spouse', 'sibling', 'muakhah', 'mawla', 'milk']
