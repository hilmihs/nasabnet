import { useMemo } from 'react'
import { useStore } from '../lib/data'
import { findPath, kinshipTerm, relIds, siblings } from '../lib/graph'
import { chainOf, meetingPoint } from '../lib/kin'
import { normAr } from '../lib/arabic'
import type { Person } from '../lib/types'
import { useUI } from '../lib/ui'
import { Empty, PersonChip } from './bits'
import { GraphCanvas, Legend, type GEdge, type GNode } from './GraphCanvas'
import { KinPanel, SharedKin } from './KinPanel'
import { MeetingTree } from './MeetingTree'
import { PathDiagram } from './PathDiagram'

/**
 * Two-person comparison for the vertical lineage view: tree from the meeting point down to both,
 * then their kinship web, the people descending from the same meeting point, and related companions.
 */
export function CompareKin({ a, b }: { a: Person; b: Person }) {
  const { g, ancestors, weight, colorOf } = useStore()
  const { openProfile } = useUI()
  const meeting = useMemo(() => meetingPoint(a, b), [a, b])
  const path = useMemo(() => findPath(g, a.id, b.id, { maxDepth: 12 }), [g, a, b])

  // descendants of the meeting ancestor (other companions on the same nasab tree)
  const sameTree = useMemo(() => {
    if (!meeting || meeting.upA === 0 || meeting.upB === 0) return []
    const ca = chainOf(a)
    const i = meeting.upA
    const key = `${normAr(ca[i].ar)}|${ca[i + 1] ? normAr(ca[i + 1].ar) : ''}`
    return (ancestors.byKey.get(key) ?? [])
      .filter((x) => x.id !== a.id && x.id !== b.id && g.byId.get(x.id)?.comp)
      .sort((x, y) => x.up - y.up || weight(y.id) - weight(x.id))
      .slice(0, 48)
  }, [meeting, a, b, ancestors, g, weight])

  // kinship web: both people, their path, and their immediate families
  const { nodes, edges } = useMemo(() => {
    const ids = new Set<string>([a.id, b.id, ...(path ?? []).map((h) => h.to)])
    for (const x of [a.id, b.id]) {
      relIds(g, x, 'parent', 'spouse', 'child').forEach((y) => ids.add(y))
      siblings(g, x).slice(0, 8).forEach((y) => ids.add(y))
    }
    const onPath = new Set([a.id, b.id, ...(path ?? []).map((h) => h.to)])
    const nodes: GNode[] = [...ids].map((x) => {
      const q = g.byId.get(x)!
      return { id: x, label: q.lat, color: colorOf(q), female: q.g === 'f', focus: x === a.id || x === b.id, dim: !onPath.has(x) && path !== null, size: onPath.has(x) ? 34 : 22 }
    })
    const edges: GEdge[] = []
    for (const e of g.data.edges) if (ids.has(e.s) && ids.has(e.t) && e.k !== 'mawla') edges.push({ id: `${e.s}-${e.t}-${e.k}`, source: e.s, target: e.t, kind: e.k })
    return { nodes, edges }
  }, [g, a, b, path, colorOf])

  const term = path && path.length ? kinshipTerm(g, path) : null

  return (
    <div className="space-y-6">
      {meeting ? (
        <MeetingTree a={a} b={b} m={meeting} />
      ) : (
        <Empty>Rantai nasab yang tercatat untuk keduanya belum bertemu pada leluhur yang sama (berbeda kabilah besar atau rantai terlalu pendek).</Empty>
      )}

      <section className="card p-4 sm:p-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Jejaring kekerabatan</p>
        <h3 className="mt-1 font-display text-2xl font-semibold text-hijau-900">
          {path === null
            ? 'Belum ada jalur keluarga yang tercatat di antara keduanya'
            : term
              ? `${b.lat} adalah ${term} dari ${a.lat}`
              : `Terhubung melalui ${path.length} langkah keluarga`}
        </h3>
        {path && path.length > 0 && (
          <div className="mt-3">
            <PathDiagram start={a.id} path={path} />
          </div>
        )}
        {edges.length > 0 && (
          <div className="mt-4">
            <GraphCanvas nodes={nodes} edges={edges} layout="cose" onNodeClick={openProfile} height={420} ariaLabel={`Jejaring keluarga ${a.lat} dan ${b.lat}`} />
            <div className="mt-2">
              <Legend kinds={['parent', 'spouse', 'sibling', 'muakhah']} />
            </div>
          </div>
        )}
      </section>

      {sameTree.length > 0 && meeting && (
        <section className="card p-4 sm:p-5">
          <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Satu pohon nasab</p>
          <h3 className="mt-1 font-display text-2xl font-semibold text-hijau-900">
            Sahabat lain keturunan <span className="ar">{meeting.ancestor.ar}</span>
          </h3>
          <p className="mb-2 text-sm text-tinta-soft">Mereka bertemu nasab dengan kedua tokoh di titik temu yang sama; diurutkan dari yang paling dekat generasinya.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {sameTree.map((x) => (
              <PersonChip key={x.id} id={x.id} sub={`${x.up} generasi di bawah titik temu`} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <KinPanel p={a} />
        <KinPanel p={b} />
      </div>
      <SharedKin a={a} b={b} />
    </div>
  )
}
