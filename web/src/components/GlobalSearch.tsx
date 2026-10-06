import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/data'
import { pushHistory } from '../lib/store'
import { useUI } from '../lib/ui'
import { Icon } from './Icon'

/** Header search: people + tribes, Ctrl/⌘+K to focus. Respects the active Smart Filter. */
export function GlobalSearch() {
  const { g, search, tribes, membersByTribe } = useStore()
  const { openProfile, go, filters } = useUI()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const hits = q.trim() ? search(q, { limit: 14, cats: filters }) : []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
        setOpen(true)
      }
    }
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', close)
    }
  }, [])

  const choose = (i: number) => {
    const h = hits[i]
    if (!h) return
    if (h.kind === 'tribe') {
      pushHistory({ kind: 'tribe', ref: h.id, label: tribes.get(h.id)?.name ?? h.id })
      go('kabilah', { t: h.id })
    } else openProfile(h.id)
    setQ('')
    setOpen(false)
    input.current?.blur()
  }

  return (
    <div ref={box} className="relative w-full max-w-xl">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-emas-300" />
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, hits.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') choose(active)
          else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Cari sahabat, istri, atau kabilah… (عربي / Latin)"
        aria-label="Pencarian global"
        className="w-full rounded-full border border-white/10 bg-white/10 py-2.5 pr-16 pl-10 text-sm text-krem-50 outline-none placeholder:text-krem-200/60 focus:border-emas-400/60 focus:bg-white/15"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] text-krem-200/70 sm:block">Ctrl K</kbd>
      {open && q.trim() && (
        <div className="animate-pop absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-krem-300 bg-white text-tinta shadow-2xl">
          {filters.length > 0 && <div className="border-b border-krem-200 bg-krem-100 px-4 py-1.5 text-[11px] text-tinta-soft">Filter aktif diterapkan pada hasil orang.</div>}
          {hits.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-tinta-soft">Tidak ada hasil untuk “{q}”.</div>
          ) : (
            <ul className="scroll-thin max-h-[60vh] overflow-auto p-1">
              {hits.map((h, i) => {
                if (h.kind === 'tribe') {
                  const t = tribes.get(h.id)!
                  return (
                    <li key={`t${h.id}`}>
                      <button type="button" onMouseEnter={() => setActive(i)} onClick={() => choose(i)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${i === active ? 'bg-hijau-50' : ''}`}>
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-hijau-800 text-emas-300">
                          <Icon name="tribes" className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{t.name}</span>
                          <span className="block text-xs text-tinta-soft">Kabilah · {membersByTribe.get(t.id)?.length ?? 0} tokoh</span>
                        </span>
                        <span className="ar text-sm text-tinta-soft">{t.ar}</span>
                      </button>
                    </li>
                  )
                }
                const p = g.byId.get(h.id)!
                return (
                  <li key={h.id}>
                    <button type="button" onMouseEnter={() => setActive(i)} onClick={() => choose(i)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${i === active ? 'bg-hijau-50' : ''}`}>
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-krem-200 text-xs text-hijau-800">{p.g === 'f' ? '♀' : '♂'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.lat}</span>
                        <span className="block truncate text-xs text-tinta-soft">{p.tribe ? tribes.get(p.tribe)?.name : '—'}{p.comp ? ' · Sahabat' : ''}</span>
                      </span>
                      <span className="ar max-w-[40%] truncate text-sm text-tinta-soft">{p.ar}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
