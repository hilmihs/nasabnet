import { useStore } from '../lib/data'
import type { Meeting, Rung } from '../lib/kin'
import type { Person } from '../lib/types'
import { useUI } from '../lib/ui'

function Node({ r, end, gen, color }: { r: Rung; end?: Person; gen: number; color: string }) {
  const { g } = useStore()
  const { openProfile } = useUI()
  const p = r.id ? g.byId.get(r.id) : undefined
  const body = (
    <>
      <span className="ar block text-[15px] leading-snug">{p && !end ? p.ar.split(/\s+بن(?:ت)?\s/)[0] : r.ar}</span>
      <span className={`block text-[10px] leading-tight ${end ? 'text-emas-300' : 'text-tinta-soft'}`}>
        {end ? end.lat : p ? p.lat : `generasi ke-${gen}`}
      </span>
    </>
  )
  const cls = end
    ? 'border-emas-400 bg-hijau-800 text-krem-50 shadow-md'
    : p
      ? 'border-hijau-600/40 bg-white text-hijau-900 hover:border-hijau-600'
      : 'border-krem-300 bg-krem-50 text-tinta'
  return (
    <li className="relative flex flex-col items-center">
      <span className="h-4 w-0.5" style={{ background: color }} aria-hidden="true" />
      {p || end ? (
        <button type="button" onClick={() => openProfile((end ?? p)!.id)} className={`w-full max-w-[13rem] rounded-xl border px-3 py-1.5 text-center transition ${cls}`}>
          {body}
        </button>
      ) : (
        <div className={`w-full max-w-[13rem] rounded-xl border px-3 py-1.5 text-center ${cls}`}>{body}</div>
      )}
    </li>
  )
}

function Branch({ rungs, end, color }: { rungs: Rung[]; end: Person; color: string }) {
  return (
    <ol className="flex flex-1 flex-col items-stretch">
      {rungs.map((r, i) => (
        <Node key={`${r.ar}-${i}`} r={r} gen={i + 1} end={i === rungs.length - 1 ? end : undefined} color={color} />
      ))}
    </ol>
  )
}

/**
 * Family-tree diagram from the shared patrilineal ancestor down to two people:
 * the meeting point on top, then one column of generations for each person.
 */
export function MeetingTree({ a, b, m }: { a: Person; b: Person; m: Meeting }) {
  const { g } = useStore()
  const { openProfile } = useUI()
  const anc = m.ancestor.id ? g.byId.get(m.ancestor.id) : undefined
  const left = m.branchA.length ? m.branchA : []
  const right = m.branchB.length ? m.branchB : []
  return (
    <figure className="card overflow-x-auto p-4 sm:p-5" aria-label={`Pohon silsilah ${a.lat} dan ${b.lat} dari titik temu`}>
      <figcaption className="mb-3 text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Pohon titik temu nasab</figcaption>
      <div className="mx-auto min-w-[300px] max-w-3xl">
        <div className="flex justify-center">
          <button
            type="button"
            disabled={!anc}
            onClick={() => anc && openProfile(anc.id)}
            className="rounded-2xl border-2 border-emas-400 bg-emas-100 px-5 py-2 text-center shadow-sm enabled:hover:bg-emas-300/40"
          >
            <span className="block text-[10px] font-semibold tracking-[0.18em] text-emas-700 uppercase">Titik temu</span>
            <span className="ar block text-xl text-hijau-900">{m.ancestor.ar}</span>
            {anc && <span className="block text-[11px] text-tinta-soft">{anc.lat}</span>}
          </button>
        </div>
        {/* connector: stem + horizontal bar over the two columns */}
        <div className="flex justify-center" aria-hidden="true">
          <span className="h-4 w-0.5 bg-emas-500" />
        </div>
        {left.length > 0 && right.length > 0 ? (
          <>
            <div className="mx-[25%] h-0.5 bg-emas-500" aria-hidden="true" />
            <div className="flex gap-3 sm:gap-6">
              <Branch rungs={left} end={a} color="#c49b2a" />
              <Branch rungs={right} end={b} color="#c49b2a" />
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-[14rem]">
            <Branch rungs={left.length ? left : right} end={left.length ? a : b} color="#c49b2a" />
          </div>
        )}
        <p className="mt-4 text-center text-sm text-tinta-soft">
          {left.length && right.length ? (
            <>
              {a.lat} berada <b>{m.upA}</b> generasi dan {b.lat} <b>{m.upB}</b> generasi di bawah <span className="ar">{m.ancestor.ar}</span>.
            </>
          ) : (
            <>
              {(left.length ? b : a).lat} adalah leluhur langsung {(left.length ? a : b).lat} ({Math.max(m.upA, m.upB)} generasi).
            </>
          )}{' '}
          Kotak putih dapat diklik (tokoh tercatat); kotak krem adalah nama dalam rantai nasab.
        </p>
      </div>
    </figure>
  )
}
