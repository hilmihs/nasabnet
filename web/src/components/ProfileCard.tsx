import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isArabic } from '../lib/arabic'
import { toBullets } from '../lib/bio'
import { useStore } from '../lib/data'
import { inLaws, relIds, siblings } from '../lib/graph'
import { pushHistory, toggleBookmark, useSaved } from '../lib/store'
import { useUI, type ProfileTab } from '../lib/ui'
import { BioCard, ProfileRefs } from './BioCard'
import { CategoryBadge, PersonChip } from './bits'
import { Icon } from './Icon'
import { Accordion, ArBlock, Bullets, Li, Rich } from './Prose'

function Group({ title, ids, sub }: { title: string; ids: string[]; sub?: (id: string) => string | undefined }) {
  if (!ids.length) return null
  return (
    <section className="overflow-hidden rounded-2xl border border-krem-300 bg-white" aria-label={title}>
      <h4 className="flex items-center justify-between gap-2 border-b border-krem-200 bg-krem-50 px-4 py-2.5 text-xs font-bold tracking-[0.12em] text-emas-700 uppercase">
        {title}
        <span className="rounded-full bg-krem-200 px-2 py-0.5 text-[11px] tracking-normal text-tinta">{ids.length}</span>
      </h4>
      <ul className="divide-y divide-krem-200">
        {ids.map((id) => (
          <li key={id}>
            <PersonChip id={id} sub={sub?.(id)} layout="row" />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Heading over several kin groups (keluarga inti, karena pernikahan, ikatan lain). */
function Tier({ title, children, show }: { title: string; children: ReactNode; show: boolean }) {
  if (!show) return null
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-hijau-900">
        <span className="h-px w-4 bg-emas-500" aria-hidden="true" />
        {title}
        <span className="h-px flex-1 bg-krem-300" aria-hidden="true" />
      </p>
      {children}
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
  const parentIds = [father, mother].filter(Boolean) as string[]

  // mother of each child, shown next to the child
  const motherOf = (cid: string) => {
    const m = relIds(g, cid, 'parent').find((x) => x !== id)
    return m ? `ibu: ${g.byId.get(m)?.lat}` : undefined
  }
  const spouseNote = (sid: string) => {
    const e = g.adj.get(id)?.find((h) => h.to === sid && h.rel === 'spouse')?.edge
    return e?.n
  }
  // "Kerabat lain menurut sumber — sepupu: X; halif: Y" → heading + one bullet per relative
  const [noteHead, noteBody] = p.note?.includes(' — ') ? p.note.split(' — ', 2) : [undefined, p.note]
  const tabs = [
    ['keluarga', 'Kartu Keluarga'],
    ['bio', 'Biografi'],
  ] as const

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
        <div className="pattern-bg relative px-5 pt-5 pb-5 text-krem-50 sm:px-6">
          <button type="button" onClick={onClose} className="absolute top-3 right-3 grid h-11 w-11 place-items-center rounded-full text-krem-200 hover:bg-white/10" aria-label="Tutup">
            <Icon name="x" />
          </button>
          <p className="pr-12 text-[11px] font-semibold tracking-[0.2em] text-emas-300 uppercase">
            {p.id === 'nabi' ? 'Rasulullah ﷺ' : p.comp ? (p.g === 'f' ? 'Shahabiyah' : 'Sahabat') : 'Tokoh terkait'}
            {t ? ` · ${t.name}` : ''}
          </p>
          <h2 className="mt-1 pr-10 font-display text-3xl leading-tight font-semibold">{p.lat}</h2>
          <p dir="rtl" lang="ar" className="ar mt-2 text-right text-[26px] leading-[1.7] text-emas-100">
            {p.ar}
          </p>
          {p.full && p.full !== p.ar && (
            <p dir="rtl" lang="ar" className="ar mt-1 text-right text-lg leading-[1.9] text-krem-200">
              {p.full}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.cats.map((c) => (
              <CategoryBadge key={c} c={c} />
            ))}
          </div>
        </div>

        <div className="border-b border-krem-300 bg-krem-50 py-3">
          <div className="flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Aksi tokoh">
            <ActionBtn primary icon="tree" onClick={() => (onClose(), go('silsilah', { p: id }))}>
              Silsilah vertikal
            </ActionBtn>
            <ActionBtn icon="route" onClick={() => (onClose(), go('relasi', { a: id }))}>
              Cari hubungan
            </ActionBtn>
            <ActionBtn icon="rings" onClick={() => (onClose(), go('nikah', { p: id }))}>
              Jejaring pernikahan
            </ActionBtn>
            <ActionBtn icon="bookmark" active={marked} onClick={() => toggleBookmark({ kind: 'person', ref: id, label: p.lat })}>
              {marked ? 'Tersimpan' : 'Simpan'}
            </ActionBtn>
          </div>
        </div>

        <div className="sticky top-0 z-10 flex border-b border-krem-300 bg-krem-50/95 px-2 backdrop-blur sm:px-4" role="tablist" aria-label="Bagian profil">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`tab-${k}`}
              aria-selected={tab === k}
              aria-controls={`panel-${k}`}
              onClick={() => setTab(k)}
              className={`relative min-h-12 flex-1 px-3 text-sm transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hijau-700 ${
                tab === k ? 'font-bold text-hijau-900' : 'font-medium text-tinta-soft hover:text-hijau-800'
              }`}
            >
              {label}
              <span className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-full transition ${tab === k ? 'bg-emas-500' : 'bg-transparent'}`} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'bio' ? (
            <BioCard p={p} />
          ) : (
            <>
              <dl className="grid gap-px overflow-hidden rounded-2xl border border-krem-300 bg-krem-200 sm:grid-cols-2" aria-label="Data pokok">
                {p.kunya && <Fact k="Kunyah" v={p.kunya} />}
                {p.laqab && <Fact k="Laqab" v={p.laqab} />}
                {t && (
                  <Fact
                    k="Kabilah"
                    v={
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1 text-left text-[15px] font-semibold text-hijau-700 underline decoration-hijau-600/30 underline-offset-4 hover:decoration-hijau-700"
                        onClick={() => (onClose(), go('kabilah', { t: t.id }))}
                      >
                        {t.name}
                        <Icon name="chevron" className="h-4 w-4" />
                      </button>
                    }
                  />
                )}
                {p.nisba && <Fact k="Nisbah" v={p.nisba} />}
                {p.death && <Fact k="Wafat" v={p.death} />}
                {p.place && <Fact k="Domisili" v={p.place} />}
                {p.rank && <Fact k="Martabat (Ibnu Hajar)" v={p.rank} />}
              </dl>

              <Tier title="Keluarga inti" show={parentIds.length + law.spouses.length + children.length + sibs.length > 0}>
                <Group title="Orang tua" ids={parentIds} />
                <Group title={p.g === 'f' ? 'Suami' : 'Istri'} ids={law.spouses} sub={spouseNote} />
                <Group title="Anak" ids={children} sub={motherOf} />
                <Group title="Saudara" ids={sibs} />
              </Tier>
              <Tier title="Kerabat karena pernikahan" show={law.parentsInLaw.length + law.childrenInLaw.length + law.siblingsInLaw.length + law.coInLaws.length > 0}>
                <Group title="Mertua" ids={law.parentsInLaw} />
                <Group title="Menantu" ids={law.childrenInLaw} />
                <Group title="Ipar" ids={law.siblingsInLaw} />
                <Group title="Besan" ids={law.coInLaws} />
              </Tier>
              <Tier title="Ikatan lain" show={muakhah.length + milk.length + patrons.length + clients.length > 0}>
                <Group title="Saudara mu'akhah" ids={muakhah} />
                <Group title="Saudara sepersusuan" ids={milk} />
                <Group title="Tuan (wala')" ids={patrons} />
                <Group title="Maula" ids={clients} />
              </Tier>

              {noteBody && (
                <section className="rounded-2xl border border-krem-300 bg-white px-4 py-3.5" aria-label={noteHead ?? 'Catatan'}>
                  <h4 className="mb-2 text-xs font-bold tracking-[0.12em] text-emas-700 uppercase">{noteHead ?? 'Catatan'}</h4>
                  <Bullets>
                    {toBullets(noteBody).map((x, i) => (
                      <Li key={i}>
                        <Rich text={x} />
                      </Li>
                    ))}
                  </Bullets>
                </section>
              )}
            </>
          )}

          <div className="space-y-3 border-t border-krem-300 pt-5">
            {p.rel && (
              <Accordion title="Teks sumber relasi (Data Rawi)" icon="network">
                <ArBlock className="text-lg text-tinta">{p.rel}</ArBlock>
              </Accordion>
            )}
            <ProfileRefs p={p} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** One fact cell; Arabic values get their own right-aligned, larger line and are never truncated. */
function Fact({ k, v }: { k: string; v: ReactNode }) {
  const ar = typeof v === 'string' && isArabic(v)
  return (
    <div className="min-w-0 bg-white px-4 py-3 sm:last:odd:col-span-2">
      <dt className="text-[11px] font-semibold tracking-wide text-tinta-soft uppercase">{k}</dt>
      {ar ? (
        <dd dir="rtl" lang="ar" className="ar mt-0.5 text-right text-xl leading-[1.8] break-words text-tinta">
          {(v as string).replace(/[.。]+$/, '')}
        </dd>
      ) : (
        <dd className="mt-0.5 break-words text-[15px] text-tinta">{v}</dd>
      )}
    </div>
  )
}

function ActionBtn({
  icon,
  children,
  onClick,
  active,
  primary,
}: {
  icon: 'tree' | 'rings' | 'route' | 'bookmark'
  children: ReactNode
  onClick: () => void
  active?: boolean
  primary?: boolean
}) {
  const tone = primary
    ? 'border-hijau-800 bg-hijau-800 text-krem-50 shadow-sm hover:bg-hijau-700'
    : active
      ? 'border-emas-500 bg-emas-100 text-emas-700'
      : 'border-krem-300 bg-white text-hijau-800 hover:border-hijau-600'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={icon === 'bookmark' ? !!active : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hijau-700 ${tone}`}
    >
      <Icon name={icon} className="h-4 w-4" filled={active && icon === 'bookmark'} />
      {children}
    </button>
  )
}
