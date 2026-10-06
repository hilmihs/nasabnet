import { useMemo } from 'react'
import { Empty, PersonChip, SectionTitle, SmartFilter, useTribeColor } from '../components/bits'
import { GraphCanvas, Legend, type GEdge, type GNode } from '../components/GraphCanvas'
import { PersonPicker } from '../components/PersonPicker'
import { useStore } from '../lib/data'
import { inLaws, relIds } from '../lib/graph'
import { useUI } from '../lib/ui'

export function MatrimonialView() {
  const { route, go } = useUI()
  const { g } = useStore()
  const id = route.params.p && g.byId.has(route.params.p) ? route.params.p : null
  return (
    <div>
      <SectionTitle kicker="Matrimonial Alliance Network" title="Jejaring Istri & Pernikahan Silang">
        Lacak siapa saling beriparan, bermertua, dan berbesan karena pernikahan silang di antara para sahabat dan keluarga Nabi ﷺ. Pilih seorang tokoh untuk melihat
        lingkaran pernikahannya, atau jelajahi daftar “simpul pengikat” — tokoh yang paling banyak menyambungkan keluarga.
      </SectionTitle>
      <div className="card mb-6 p-4 sm:p-5">
        <PersonPicker label="Fokus pada tokoh" value={id} onChange={(v) => go('nikah', v ? { p: v } : {})} />
      </div>
      {id ? <EgoNetwork id={id} /> : <Overview />}
    </div>
  )
}

function EgoNetwork({ id }: { id: string }) {
  const { g } = useStore()
  const { openProfile } = useUI()
  const color = useTribeColor()
  const p = g.byId.get(id)!
  const law = useMemo(() => inLaws(g, id), [g, id])
  const children = useMemo(() => relIds(g, id, 'child'), [g, id])

  const { nodes, edges } = useMemo(() => {
    const ids = new Set<string>([id, ...law.spouses, ...law.parentsInLaw, ...law.siblingsInLaw, ...law.childrenInLaw, ...law.coInLaws, ...children])
    for (const s of law.spouses) relIds(g, s, 'parent').forEach((x) => ids.add(x))
    const nodes: GNode[] = [...ids].map((x) => {
      const q = g.byId.get(x)!
      return { id: x, label: q.lat, color: color(q), female: q.g === 'f', focus: x === id, size: x === id ? 44 : 26 }
    })
    const edges: GEdge[] = []
    for (const e of g.data.edges) if (ids.has(e.s) && ids.has(e.t) && e.k !== 'mawla') edges.push({ id: `${e.s}-${e.t}-${e.k}`, source: e.s, target: e.t, kind: e.k })
    return { nodes, edges }
  }, [g, id, law, children, color])

  const sections: [string, string[], string][] = [
    [p.g === 'f' ? 'Suami' : 'Istri', law.spouses, 'Pasangan yang tercatat.'],
    ['Mertua', law.parentsInLaw, 'Orang tua dari pasangan.'],
    ['Menantu', law.childrenInLaw, 'Pasangan dari anak-anak.'],
    ['Ipar', law.siblingsInLaw, 'Saudara pasangan, atau pasangan saudara.'],
    ['Besan', law.coInLaws, 'Orang tua dari menantu.'],
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="card min-w-0 p-4">
        {edges.length ? (
          <>
            <GraphCanvas nodes={nodes} edges={edges} layout="concentric" onNodeClick={openProfile} height={560} ariaLabel={`Jejaring pernikahan ${p.lat}`} />
            <div className="mt-2">
              <Legend kinds={['spouse', 'parent', 'sibling']} />
            </div>
          </>
        ) : (
          <Empty>Belum ada data pernikahan untuk tokoh ini.</Empty>
        )}
      </div>
      <div className="min-w-0 space-y-4">
        {sections.map(([title, ids, hint]) => (
          <div key={title} className="card p-4">
            <h3 className="flex items-baseline justify-between font-display text-xl font-semibold text-hijau-900">
              {title} <span className="font-sans text-xs font-semibold text-tinta-soft">{ids.length}</span>
            </h3>
            <p className="mb-1 text-xs text-tinta-soft">{hint}</p>
            {ids.length ? ids.map((x) => <PersonChip key={x} id={x} />) : <p className="py-1 text-sm text-tinta-soft/70">—</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Overview() {
  const { g, tribes, weight } = useStore()
  const { filters, go } = useUI()
  const color = useTribeColor()

  const data = useMemo(() => {
    const pass = (pid: string) => filters.length === 0 || filters.some((c) => g.byId.get(pid)?.cats.includes(c))
    const spouseEdges = g.data.edges.filter((e) => e.k === 'spouse' && (pass(e.s) || pass(e.t)))
    const deg = new Map<string, number>()
    for (const e of spouseEdges) {
      deg.set(e.s, (deg.get(e.s) ?? 0) + 1)
      deg.set(e.t, (deg.get(e.t) ?? 0) + 1)
    }
    // "connectors": people whose marriages and children's marriages tie the most families together
    const score = (pid: string) => {
      const l = inLaws(g, pid)
      return l.spouses.length * 2 + l.childrenInLaw.length + l.coInLaws.length + l.siblingsInLaw.length * 0.5
    }
    const connectors = [...deg.keys()]
      .filter(pass)
      .map((pid) => ({ pid, s: score(pid) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 24)

    // one connected web: breadth-first from the Prophet ﷺ through marriages and parent links,
    // preferring the most connected people at each ring
    const linked = new Map<string, string[]>()
    for (const e of g.data.edges) {
      if (e.k !== 'spouse' && e.k !== 'parent') continue
      if (!linked.has(e.s)) linked.set(e.s, [])
      if (!linked.has(e.t)) linked.set(e.t, [])
      linked.get(e.s)!.push(e.t)
      linked.get(e.t)!.push(e.s)
    }
    const seeds = filters.length ? [...deg.keys()].filter(pass).sort((a, b) => weight(b) - weight(a)).slice(0, 12) : ['nabi']
    const capped = new Set<string>(seeds)
    let ring = seeds
    while (ring.length && capped.size < 200) {
      const next = new Set<string>()
      for (const x of ring) for (const y of linked.get(x) ?? []) if (!capped.has(y) && (deg.has(y) || weight(y) > 8)) next.add(y)
      const ranked = [...next].sort((a, b) => (deg.get(b) ?? 0) * 3 + weight(b) - ((deg.get(a) ?? 0) * 3 + weight(a)))
      ring = ranked.slice(0, 200 - capped.size)
      ring.forEach((x) => capped.add(x))
    }
    const nodes: GNode[] = [...capped].map((x) => {
      const q = g.byId.get(x)!
      return { id: x, label: q.lat, color: color(q), female: q.g === 'f', focus: x === 'nabi', size: x === 'nabi' ? 46 : 14 + Math.min(30, (deg.get(x) ?? 0) * 4) }
    })
    const edges: GEdge[] = []
    for (const e of g.data.edges)
      if (capped.has(e.s) && capped.has(e.t) && (e.k === 'spouse' || e.k === 'parent')) edges.push({ id: `${e.s}-${e.t}-${e.k}`, source: e.s, target: e.t, kind: e.k })

    // cross-clan alliances
    const pairs = new Map<string, { n: number; ex: [string, string][] }>()
    for (const e of spouseEdges) {
      const a = g.byId.get(e.s)?.tribe
      const b = g.byId.get(e.t)?.tribe
      if (!a || !b || a === b) continue
      const k = [a, b].sort().join('|')
      const v = pairs.get(k) ?? { n: 0, ex: [] }
      v.n++
      if (v.ex.length < 4) v.ex.push([e.s, e.t])
      pairs.set(k, v)
    }
    const alliances = [...pairs.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 18)
    return { nodes, edges, connectors, alliances, total: spouseEdges.length }
  }, [g, filters, color, weight])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SmartFilter />
        <p className="text-sm text-tinta-soft">{data.total} ikatan pernikahan tercatat</p>
      </div>
      <div className="card p-4">
        <GraphCanvas nodes={data.nodes} edges={data.edges} onNodeClick={(x) => go('nikah', { p: x })} height={620} ariaLabel="Jejaring pernikahan para sahabat" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Legend kinds={['spouse', 'parent']} />
          <span className="text-xs text-tinta-soft">Klik tokoh untuk melihat lingkaran mertua–ipar–besan.</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card p-4">
          <h3 className="font-display text-xl font-semibold text-hijau-900">Simpul pengikat keluarga</h3>
          <p className="mb-2 text-xs text-tinta-soft">Tokoh yang pernikahannya (dan pernikahan anak-anaknya) paling banyak menyambungkan keluarga lain.</p>
          <div className="grid sm:grid-cols-2">
            {data.connectors.map(({ pid }) => (
              <PersonChip key={pid} id={pid} sub={`${inLaws(g, pid).spouses.length} pasangan`} />
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="font-display text-xl font-semibold text-hijau-900">Aliansi pernikahan antarklan</h3>
          <p className="mb-2 text-xs text-tinta-soft">Pasangan klan dengan pernikahan silang terbanyak dalam data.</p>
          <ul className="divide-y divide-krem-200">
            {data.alliances.map(([k, v]) => {
              const [a, b] = k.split('|')
              return (
                <li key={k} className="py-2">
                  <div className="flex items-center justify-between gap-2 text-sm font-semibold text-hijau-900">
                    <span>
                      {tribes.get(a)?.name} <span className="text-emas-600">⟷</span> {tribes.get(b)?.name}
                    </span>
                    <span className="rounded-full bg-emas-100 px-2 text-xs text-emas-700">{v.n}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-tinta-soft">
                    {v.ex.map(([s, t], i) => (
                      <span key={i}>
                        {i > 0 && '; '}
                        <button className="hover:text-hijau-700 hover:underline" onClick={() => go('nikah', { p: s })}>
                          {g.byId.get(s)?.lat}
                        </button>{' '}
                        ×{' '}
                        <button className="hover:text-hijau-700 hover:underline" onClick={() => go('nikah', { p: t })}>
                          {g.byId.get(t)?.lat}
                        </button>
                      </span>
                    ))}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
