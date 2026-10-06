import { useEffect, useId, useRef, useState } from 'react'
import { useStore } from '../lib/data'
import { Icon } from './Icon'

/** Autocomplete for choosing one person (Arabic or Latin query). */
export function PersonPicker({
  value,
  onChange,
  placeholder = 'Ketik nama sahabat…',
  label,
}: {
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  label: string
}) {
  const { g, search, tribes } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const box = useRef<HTMLDivElement>(null)
  const p = value ? g.byId.get(value) : undefined
  const hits = q.trim() ? search(q, { kinds: ['person'], limit: 12 }) : []

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const choose = (id: string) => {
    onChange(id)
    setQ('')
    setOpen(false)
  }

  return (
    <div ref={box} className="relative">
      <label className="mb-1 block text-xs font-semibold tracking-wide text-tinta-soft uppercase">{label}</label>
      {p ? (
        <div className="flex items-center gap-3 rounded-xl border border-hijau-600/30 bg-hijau-50 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-hijau-900">{p.lat}</div>
            <div className="ar truncate text-sm text-tinta-soft">{p.ar}</div>
          </div>
          <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1.5 text-tinta-soft hover:bg-white hover:text-tinta" aria-label="Ganti pilihan">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-tinta-soft" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
              setActive(0)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, hits.length - 1))
              else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
              else if (e.key === 'Enter' && hits[active]) choose(hits[active].id)
              else if (e.key === 'Escape') setOpen(false)
            }}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={open && hits.length > 0}
            aria-controls={listId}
            className="w-full rounded-xl border border-krem-300 bg-white py-2.5 pr-3 pl-9 text-sm outline-none placeholder:text-tinta-soft/70 focus:border-hijau-600 focus:ring-2 focus:ring-hijau-600/15"
          />
        </div>
      )}
      {open && !p && hits.length > 0 && (
        <ul id={listId} role="listbox" className="animate-pop scroll-thin absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-krem-300 bg-white p-1 shadow-xl">
          {hits.map((h, i) => {
            const x = g.byId.get(h.id)!
            return (
              <li key={h.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(h.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${i === active ? 'bg-hijau-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{x.lat}</span>
                    <span className="block truncate text-xs text-tinta-soft">{x.tribe ? tribes.get(x.tribe)?.name : 'Kabilah tidak diketahui'}</span>
                  </span>
                  <span className="ar shrink-0 text-sm text-tinta-soft">{x.ar}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
