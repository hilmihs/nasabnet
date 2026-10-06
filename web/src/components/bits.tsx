import type { ReactNode } from 'react'
import { useStore } from '../lib/data'
import { useUI } from '../lib/ui'
import { CATEGORY_LABEL, type Category } from '../lib/types'
import { Icon } from './Icon'

export function useTribeColor() {
  return useStore().colorOf
}

export function PersonChip({ id, sub, compact = false }: { id: string; sub?: ReactNode; compact?: boolean }) {
  const { g, tribes } = useStore()
  const { openProfile } = useUI()
  const color = useTribeColor()
  const p = g.byId.get(id)
  if (!p) return null
  const t = p.tribe ? tribes.get(p.tribe) : undefined
  return (
    <button
      type="button"
      onClick={() => openProfile(id)}
      className="group flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 text-left transition hover:border-krem-300 hover:bg-krem-50"
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white"
        style={{ background: color(p) }}
        aria-hidden="true"
      >
        {p.g === 'f' ? '♀' : '♂'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-tinta group-hover:text-hijau-700">{p.lat}</span>
        {!compact && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-tinta-soft">
            <span className="ar truncate text-[13px]">{p.ar}</span>
            {sub ? <span className="truncate">· {sub}</span> : t ? <span className="truncate">· {t.name}</span> : null}
          </span>
        )}
      </span>
    </button>
  )
}

export function CategoryBadge({ c }: { c: Category }) {
  const tone: Record<Category, string> = {
    muhajirin: 'bg-hijau-100 text-hijau-800',
    anshar: 'bg-emas-100 text-emas-700',
    ahlulbait: 'bg-hijau-800 text-emas-300',
    kerabat: 'bg-hijau-50 text-hijau-700 ring-1 ring-hijau-100',
    ummahat: 'bg-emas-400/20 text-emas-700 ring-1 ring-emas-300',
    asyarah: 'bg-krem-200 text-tinta',
    badar: 'bg-krem-200 text-hijau-800',
    khulafa: 'bg-emas-500 text-white',
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone[c]}`}>{CATEGORY_LABEL[c]}</span>
}

export const FILTER_CATS: Category[] = ['muhajirin', 'anshar', 'ahlulbait', 'kerabat', 'ummahat', 'khulafa', 'asyarah', 'badar']

export function SmartFilter({ counts }: { counts?: Partial<Record<Category, number>> }) {
  const { filters, setFilters } = useUI()
  const toggle = (c: Category) => setFilters(filters.includes(c) ? filters.filter((x) => x !== c) : [...filters, c])
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter kategori sosial">
      <span className="flex items-center gap-1 text-xs font-semibold tracking-wide text-tinta-soft uppercase">
        <Icon name="filter" className="h-3.5 w-3.5" /> Filter
      </span>
      {FILTER_CATS.map((c) => {
        const on = filters.includes(c)
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              on ? 'border-hijau-800 bg-hijau-800 text-krem-50 shadow-sm' : 'border-krem-300 bg-krem-50 text-tinta hover:border-emas-400'
            }`}
          >
            {CATEGORY_LABEL[c]}
            {counts?.[c] !== undefined && <span className={`ml-1.5 ${on ? 'text-emas-300' : 'text-tinta-soft'}`}>{counts[c]}</span>}
          </button>
        )
      })}
      {filters.length > 0 && (
        <button type="button" onClick={() => setFilters([])} className="text-xs font-medium text-emas-700 underline-offset-2 hover:underline">
          Reset
        </button>
      )}
    </div>
  )
}

export function SectionTitle({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      {kicker && <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">{kicker}</p>}
      <h1 className="font-display text-3xl font-semibold text-hijau-900 sm:text-4xl">{title}</h1>
      {children && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-tinta-soft">{children}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-krem-300 px-4 py-8 text-center text-sm text-tinta-soft">{children}</div>
}
