import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../lib/data'
import { inLaws, relIds, siblings } from '../lib/graph'
import { pushHistory, toggleBookmark, useSaved } from '../lib/store'
import { useUI, type ProfileTab } from '../lib/ui'
import { BioCard } from './BioCard'
import { CategoryBadge, PersonChip } from './bits'
import { Icon } from './Icon'

function Group({ title, ids, sub }: { title: string; ids: string[]; sub?: (id: string) => string | undefined }) {
  if (!ids.length) return null
  return (
    <div>
      <h4 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-emas-700 uppercase">
        {title} <span className="text-tinta-soft">({ids.length})</span>
      </h4>
      <div className="grid gap-0.5 sm:grid-cols-2">
        {ids.map((id) => (
          <PersonChip key={id} id={id} sub={sub?.(id)} />
        ))}
      </div>
    </div>
  )
}

/** Instant profile card: father, tribe, spouses, children, close relatives. */
export function ProfileCard({ id, onClose, initialTab = 'keluarga' }: { id: string; onClose: () => void; initialTab?: ProfileTab }) {
  const [tab, setTab] = useState<ProfileTab>(initialTab)
  const { g, tribes } = useStore()
  const { go } = useUI()
  const { isBookmarked } = useSaved()
  const panel = useRef<HTMLDivElement>(null)
  const p = g.byId.get(id)

  useEffect(() => {
    if (p) pushHistory({ kind: 'person', ref: p.id, label: p.lat })
  }, [p])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!p) return null
  const t = p.tribe ? tribes.get(p.tribe) : undefined
  const parents = relIds(g, id, 'parent')
  const father = parents.find((x) => g.byId.get(x)?.g === 'm')
  const mother = parents.find((x) => g.byId.get(x)?.g === 'f')
  const law = inLaws(g, id)
  const children = relIds(g, id, 'child')
  const sibs = siblings(g, id)
  const muakhah = relIds(g, id, 'muakhah')
  const patrons = relIds(g, id, 'patron')
  const clients = relIds(g, id, 'client')
  const milk = relIds(g, id, 'milk')
  const marked = isBookmarked('person', id)

  // mother of each child, shown next to the child
  const motherOf = (cid: string) => {
    const m = relIds(g, cid, 'parent').find((x) => x !== id)
    return m ? `ibu: ${g.byId.get(m)?.lat}` : undefined
  }
  const spouseNote = (sid: string) => {
    const e = g.adj.get(id)?.find((h) => h.to === sid && h.rel === 'spouse')?.edge
    return e?.n
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-hijau-950/50 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Profil ${p.lat}`}
        className="animate-pop scroll-thin max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-3xl bg-krem-50 shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="pattern-bg relative px-6 pt-6 pb-5 text-krem-50">
          <button type="button" onClick={onClose} className="absolute top-4 right-4 rounded-full p-2 text-krem-200 hover:bg-white/10" aria-label="Tutup">
            <Icon name="x" />
          </button>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-emas-300 uppercase">
            {p.id === 'nabi' ? 'Rasulullah ﷺ' : p.comp ? (p.g === 'f' ? 'Shahabiyah' : 'Sahabat') : 'Tokoh terkait'}
            {t ? ` · ${t.name}` : ''}
          </p>
          <h2 className="mt-1 pr-10 font-display text-3xl leading-tight font-semibold">{p.lat}</h2>
          <p className="ar mt-1 text-2xl text-emas-100">{p.ar}</p>
          {p.full && p.full !== p.ar && <p className="ar mt-1 text-sm text-krem-200/80">{p.full}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.cats.map((c) => (
              <CategoryBadge key={c} c={c} />
            ))}
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            {p.kunya && <Fact k="Kunyah" v={<span className="ar">{p.kunya}</span>} />}
            {p.laqab && <Fact k="Laqab" v={<span className="ar">{p.laqab}</span>} />}
            {t && <Fact k="Kabilah" v={<button className="text-left font-medium text-hijau-700 hover:underline" onClick={() => (onClose(), go('kabilah', { t: t.id }))}>{t.name}</button>} />}
            {p.nisba && <Fact k="Nisbah" v={<span className="ar">{p.nisba}</span>} />}
            {p.death && <Fact k="Wafat" v={p.death} />}
            {p.place && <Fact k="Domisili" v={<span className="ar">{p.place}</span>} />}
            {p.rank && <Fact k="Martabat (Ibnu Hajar)" v={<span className="ar">{p.rank}</span>} />}
          </dl>

          <div className="flex flex-wrap gap-2">
            <ActionBtn icon="tree" onClick={() => (onClose(), go('silsilah', { p: id }))}>Silsilah vertikal</ActionBtn>
            <ActionBtn icon="rings" onClick={() => (onClose(), go('nikah', { p: id }))}>Jejaring pernikahan</ActionBtn>
            <ActionBtn icon="route" onClick={() => (onClose(), go('relasi', { a: id }))}>Cari hubungan</ActionBtn>
            <ActionBtn icon="bookmark" active={marked} onClick={() => toggleBookmark({ kind: 'person', ref: id, label: p.lat })}>
              {marked ? 'Tersimpan' : 'Simpan'}
            </ActionBtn>
          </div>

          <div className="flex gap-1 rounded-full border border-krem-300 bg-white p-1 text-xs font-semibold" role="tablist">
            {(
              [
                ['keluarga', 'Kartu Keluarga'],
                ['bio', 'Biografi'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`flex-1 rounded-full px-3 py-1.5 transition ${tab === k ? 'bg-hijau-800 text-krem-50' : 'text-hijau-800 hover:bg-krem-100'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'bio' ? (
            <BioCard p={p} />
          ) : (
          <>
          <Group title="Orang tua" ids={[father, mother].filter(Boolean) as string[]} />
          <Group title={p.g === 'f' ? 'Suami' : 'Istri'} ids={law.spouses} sub={spouseNote} />
          <Group title="Anak" ids={children} sub={motherOf} />
          <Group title="Saudara" ids={sibs} />
          <Group title="Mertua" ids={law.parentsInLaw} />
          <Group title="Menantu" ids={law.childrenInLaw} />
          <Group title="Ipar" ids={law.siblingsInLaw} />
          <Group title="Besan" ids={law.coInLaws} />
          <Group title="Saudara mu'akhah" ids={muakhah} />
          <Group title="Saudara sepersusuan" ids={milk} />
          <Group title="Tuan (wala')" ids={patrons} />
          <Group title="Maula" ids={clients} />

          {p.rel && (
            <div className="rounded-xl bg-krem-100 p-4">
              <h4 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-emas-700 uppercase">Catatan relasi (teks sumber)</h4>
              <p className="ar text-[15px] leading-loose text-tinta">{p.rel}</p>
            </div>
          )}
          {p.note && <p className="text-sm text-tinta-soft">{p.note}</p>}

          </>
          )}

          <div>
            <h4 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-emas-700 uppercase">Rujukan</h4>
            <ul className="space-y-1 text-sm">
              {p.src.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Icon name="book" className="mt-0.5 h-4 w-4 shrink-0 text-emas-600" />
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-hijau-700 hover:underline">
                      {s.t} <Icon name="external" className="inline h-3 w-3" />
                    </a>
                  ) : (
                    <span>{s.t}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Fact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-tinta-soft uppercase">{k}</dt>
      <dd className="truncate text-tinta">{v}</dd>
    </div>
  )
}

function ActionBtn({ icon, children, onClick, active }: { icon: 'tree' | 'rings' | 'route' | 'bookmark'; children: ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'border-emas-500 bg-emas-100 text-emas-700' : 'border-krem-300 bg-white text-hijau-800 hover:border-hijau-600'
      }`}
    >
      <Icon name={icon} className="h-4 w-4" filled={active && icon === 'bookmark'} />
      {children}
    </button>
  )
}
