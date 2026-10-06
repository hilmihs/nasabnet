import { Fragment } from 'react'
import { useStore } from '../lib/data'
import { hopLabel, type Hop } from '../lib/graph'
import { useUI } from '../lib/ui'
import { useTribeColor } from './bits'

const REL_TONE: Record<string, string> = {
  spouse: '#c49b2a',
  parent: '#1d6a54',
  child: '#1d6a54',
  sibling: '#7a8a82',
  milk: '#7a8a82',
  muakhah: '#6b5b3e',
  patron: '#5a6b78',
  client: '#5a6b78',
}

/** Pathfinder: chain of people joined by labelled animated arrows. */
export function PathDiagram({ start, path }: { start: string; path: Hop[] }) {
  const { g, tribes } = useStore()
  const { openProfile } = useUI()
  const color = useTribeColor()
  const ids = [start, ...path.map((h) => h.to)]

  return (
    <ol className="flex flex-col items-stretch gap-0 md:flex-row md:flex-wrap md:items-center md:gap-y-4" aria-label="Diagram jalur hubungan">
      {ids.map((id, i) => {
        const p = g.byId.get(id)!
        const t = p.tribe ? tribes.get(p.tribe) : undefined
        const hop = path[i]
        return (
          <Fragment key={`${id}-${i}`}>
            <li>
              <button
                type="button"
                onClick={() => openProfile(id)}
                className={`w-full rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:w-48 ${
                  i === 0 || i === ids.length - 1 ? 'border-emas-400 ring-2 ring-emas-300/40' : 'border-krem-300'
                }`}
              >
                <span className="mb-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color(p) }} />
                  <span className="truncate text-[11px] font-semibold tracking-wide text-tinta-soft uppercase">{t?.name ?? '—'}</span>
                </span>
                <span className="block text-sm leading-snug font-semibold text-hijau-900">{p.lat}</span>
                <span className="ar block truncate text-[15px] text-tinta-soft">{p.ar}</span>
              </button>
            </li>
            {hop && (
              <li aria-label={`${hopLabel(g, hop)}`} className="flex items-center justify-center py-1 md:px-1 md:py-0">
                <div className="flex flex-col items-center md:flex-row">
                  <svg className="h-10 w-6 md:hidden" viewBox="0 0 24 40" aria-hidden="true">
                    <line x1="12" y1="2" x2="12" y2="32" stroke={REL_TONE[hop.rel]} strokeWidth="2.5" className="flow-line" />
                    <path d="M6 30l6 8 6-8" fill="none" stroke={REL_TONE[hop.rel]} strokeWidth="2.5" />
                  </svg>
                  <span
                    className="order-first rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white md:order-none md:mb-0"
                    style={{ background: REL_TONE[hop.rel] }}
                  >
                    {hopLabel(g, hop)}
                  </span>
                  <svg className="hidden h-6 w-14 md:block" viewBox="0 0 56 24" aria-hidden="true">
                    <line x1="2" y1="12" x2="46" y2="12" stroke={REL_TONE[hop.rel]} strokeWidth="2.5" className="flow-line" />
                    <path d="M44 6l8 6-8 6" fill="none" stroke={REL_TONE[hop.rel]} strokeWidth="2.5" />
                  </svg>
                </div>
              </li>
            )}
          </Fragment>
        )
      })}
    </ol>
  )
}
