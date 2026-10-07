import { useMemo, useState } from 'react'
import { Empty, PersonChip, SectionTitle, SmartFilter } from '../components/bits'
import { GraphCanvas, Legend, type GEdge, type GNode } from '../components/GraphCanvas'
import { Icon } from '../components/Icon'
import { TribeProfileCard } from '../components/TribeProfileCard'
import { useStore } from '../lib/data'
import { pushHistory, toggleBookmark, useSaved } from '../lib/store'
import { CATEGORY_LABEL, type Category, type Person, type Tribe } from '../lib/types'
import { useUI } from '../lib/ui'

const GROUPS: { id: Tribe['group']; title: string; desc: string }[] = [
  { id: 'quraisy', title: 'Quraisy', desc: 'Keturunan Fihr bin Malik di Makkah — mayoritas Muhajirin berasal dari klan-klan ini.' },
  { id: 'anshar', title: 'Anshar (Aus & Khazraj)', desc: 'Dua kabilah Azdiyyah di Yatsrib/Madinah yang menolong Nabi ﷺ.' },
  { id: 'arab', title: 'Kabilah Arab Lain', desc: 'Kabilah-kabilah Mudhar, Rabi’ah, dan Qahthan di luar Quraisy dan Anshar.' },
  { id: 'ajam', title: 'Non-Arab (‘Ajam)', desc: 'Sahabat keturunan Persia, Habasyah, Romawi, dan Qibthi.' },
]

/** Clan tree of Quraysh — where each clan branches off the common line. */
const QURAISY_TREE: { name: string; ar: string; clans: string[] }[] = [
  { name: 'Fihr (Quraisy)', ar: 'فهر', clans: ['fihr'] },
  { name: "Lu'ay", ar: 'لؤي', clans: ['amir'] },
  { name: "Ka'b", ar: 'كعب', clans: ['adi', 'sahm', 'jumah'] },
  { name: 'Murrah', ar: 'مرة', clans: ['taim', 'makhzum'] },
  { name: 'Kilab', ar: 'كلاب', clans: ['zuhrah'] },
  { name: 'Qushay', ar: 'قصي', clans: ['abduddar', 'asad'] },
  { name: 'Abdu Manaf', ar: 'عبد مناف', clans: ['hasyim', 'muthalib', 'umayyah', 'naufal'] },
]

export function TribesView() {
  const store = useStore()
  const { g, tribes, membersByTribe, tribeColorById } = store
  const { route, go, filters, openProfile } = useUI()
  const [mode, setMode] = useState<'kartu' | 'peta'>('kartu')
  const selected = route.params.t && tribes.has(route.params.t) ? tribes.get(route.params.t)! : null

  const pass = (p: Person) => filters.length === 0 || filters.some((c) => p.cats.includes(c))
  const members = (tid: string) => (membersByTribe.get(tid) ?? []).filter(pass)

  const selectedMembers = useMemo(
    () => (selected ? (membersByTribe.get(selected.id) ?? []).filter((p) => filters.length === 0 || filters.some((c) => p.cats.includes(c))) : []),
    [selected, membersByTribe, filters],
  )

  const counts = useMemo(() => {
    const c: Partial<Record<Category, number>> = {}
    for (const p of g.data.persons) for (const k of p.cats) c[k] = (c[k] ?? 0) + 1
    return c
  }, [g])

  const select = (t: Tribe) => {
    pushHistory({ kind: 'tribe', ref: t.id, label: t.name })
    go('kabilah', { t: t.id })
  }

  return (
    <div>
      <SectionTitle kicker="Tribe Network View" title="Peta Suku & Kabilah">
        Para sahabat dikelompokkan menurut kabilah asal yang tercatat pada nisbah mereka dalam basis data rawi Turath dan Thabaqat Ibnu Sa'd. Pilih kabilah untuk melihat
        anggotanya dan jejaring keluarga di dalamnya.
      </SectionTitle>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SmartFilter counts={counts} />
        <div className="inline-flex rounded-full border border-krem-300 bg-white p-1 text-xs font-semibold">
          {(['kartu', 'peta'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-3 py-1.5 ${mode === m ? 'bg-hijau-800 text-krem-50' : 'text-hijau-800'}`}>
              {m === 'kartu' ? 'Kartu kabilah' : 'Peta jaringan antarkabilah'}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <TribeDetail
          tribe={selected}
          members={selectedMembers}
          tab={route.params.tab === 'profil' ? 'profil' : 'jejaring'}
          onTab={(tab) => go('kabilah', { t: selected.id, tab })}
          onClose={() => go('kabilah')}
          onOpen={openProfile}
        />
      )}

      {mode === 'peta' ? (
        <TribeNetwork onSelect={select} />
      ) : (
        <div className="space-y-8">
          {GROUPS.map((grp) => {
            const list = g.data.tribes.filter((t) => t.group === grp.id).map((t) => ({ t, n: members(t.id).length })).filter((x) => x.n > 0)
            if (!list.length) return null
            return (
              <section key={grp.id}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-hijau-900">{grp.title}</h2>
                    <p className="text-sm text-tinta-soft">{grp.desc}</p>
                  </div>
                </div>
                {grp.id === 'quraisy' && <QuraisyTree onSelect={(id) => select(tribes.get(id)!)} counts={(id) => members(id).length} />}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {list
                    .sort((a, b) => b.n - a.n)
                    .map(({ t, n }) => (
                      <TribeCard key={t.id} tribe={t} count={n} color={tribeColorById(t.id)} top={members(t.id).slice(0, 3)} active={selected?.id === t.id} onClick={() => select(t)} />
                    ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TribeCard({ tribe, count, color, top, onClick, active }: { tribe: Tribe; count: number; color: string; top: Person[]; onClick: () => void; active: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card group relative overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${active ? 'ring-2 ring-emas-400' : ''}`}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-hijau-900">{tribe.name}</h3>
          <p className="ar text-lg text-tinta-soft">{tribe.ar}</p>
        </div>
        <span className="rounded-full bg-krem-200 px-2.5 py-0.5 text-xs font-bold text-hijau-800">{count}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-tinta-soft">{tribe.desc}</p>
      {top.length > 0 && <p className="mt-2 truncate text-xs font-medium text-hijau-700">{top.map((p) => p.lat).join(' · ')}</p>}
    </button>
  )
}

function QuraisyTree({ onSelect, counts }: { onSelect: (id: string) => void; counts: (id: string) => number }) {
  const { tribes } = useStore()
  return (
    <div className="card mb-4 overflow-x-auto p-4">
      <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Pohon klan Quraisy — titik percabangan</p>
      <ol className="flex min-w-[720px] items-start gap-0">
        {QURAISY_TREE.map((node, i) => (
          <li key={node.ar} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : 'bg-emas-400'}`} />
              <span className="rounded-full border-2 border-emas-400 bg-hijau-800 px-3 py-1 text-center">
                <span className="ar block text-sm leading-tight text-emas-100">{node.ar}</span>
                <span className="block text-[10px] leading-tight text-krem-200">{node.name}</span>
              </span>
              <span className={`h-0.5 flex-1 ${i === QURAISY_TREE.length - 1 ? 'bg-transparent' : 'bg-emas-400'}`} />
            </div>
            <span className="h-3 w-0.5 bg-hijau-600/40" />
            <div className="flex flex-col gap-1">
              {node.clans.map((c) => {
                const t = tribes.get(c)
                if (!t) return null
                return (
                  <button key={c} onClick={() => onSelect(c)} className="rounded-lg border border-krem-300 bg-white px-2 py-1 text-[11px] font-medium text-hijau-800 hover:border-hijau-600">
                    {t.name.replace(/^Bani /, 'B. ')} <span className="text-tinta-soft">{counts(c)}</span>
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-tinta-soft">
        Dibaca dari kiri (leluhur tertua) ke kanan: setiap klan bercabang dari garis utama yang kelak melahirkan Bani Hasyim, klan Nabi ﷺ. Garis nasab mengikuti
        <span className="italic"> Nasab Quraisy</span> karya Mush'ab az-Zubairi.
      </p>
    </div>
  )
}

function TribeDetail({
  tribe,
  members,
  tab,
  onTab,
  onClose,
  onOpen,
}: {
  tribe: Tribe
  members: Person[]
  tab: 'jejaring' | 'profil'
  onTab: (t: 'jejaring' | 'profil') => void
  onClose: () => void
  onOpen: (id: string) => void
}) {
  const { g, weight } = useStore()
  const { isBookmarked } = useSaved()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(60)
  const list = q ? members.filter((p) => p.lat.toLowerCase().includes(q.toLowerCase()) || p.ar.includes(q)) : members
  const women = members.filter((p) => p.g === 'f').length

  const { nodes, edges } = useMemo(() => {
    const top = [...members].sort((a, b) => weight(b.id) - weight(a.id)).slice(0, 70)
    const ids = new Set(top.map((p) => p.id))
    const nodes: GNode[] = top.map((p) => ({ id: p.id, label: p.lat, color: p.g === 'f' ? '#c49b2a' : '#155040', size: 16 + Math.min(26, weight(p.id)), female: p.g === 'f' }))
    const edges: GEdge[] = []
    for (const e of g.data.edges) if (ids.has(e.s) && ids.has(e.t)) edges.push({ id: `${e.s}-${e.t}-${e.k}`, source: e.s, target: e.t, kind: e.k })
    return { nodes, edges }
  }, [members, g, weight])

  return (
    <div className="card animate-pop mb-8 overflow-hidden">
      <div className="pattern-bg flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-krem-50">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-emas-300 uppercase">Kabilah terpilih</p>
          <h2 className="font-display text-3xl font-semibold">
            {tribe.name} <span className="ar text-2xl text-emas-100">{tribe.ar}</span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-krem-200">{tribe.desc}</p>
          <p className="mt-2 text-xs text-emas-300">
            {members.length} tokoh · {women} perempuan · {members.filter((p) => p.comp).length} sahabat
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleBookmark({ kind: 'tribe', ref: tribe.id, label: tribe.name })}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
          >
            <Icon name="bookmark" className="h-4 w-4" filled={isBookmarked('tribe', tribe.id)} /> {isBookmarked('tribe', tribe.id) ? 'Tersimpan' : 'Simpan'}
          </button>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Tutup kabilah">
            <Icon name="x" />
          </button>
        </div>
      </div>
      <div className="flex gap-1 border-b border-krem-200 px-5 pt-3 text-sm font-semibold" role="tablist">
        {(
          [
            ['jejaring', 'Anggota & Jejaring'],
            ['profil', 'Profil Kabilah 10 Poin'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => onTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 ${tab === k ? 'border-emas-500 text-hijau-900' : 'border-transparent text-tinta-soft hover:text-hijau-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'profil' ? (
        <div className="p-5">
          <TribeProfileCard tribe={tribe} />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          {edges.length > 0 ? (
            <>
              <GraphCanvas nodes={nodes} edges={edges} onNodeClick={onOpen} height={460} ariaLabel={`Jejaring keluarga di ${tribe.name}`} />
              <div className="mt-2">
                <Legend kinds={['parent', 'spouse', 'sibling', 'muakhah']} />
              </div>
            </>
          ) : (
            <Empty>Belum ada relasi keluarga antaranggota yang terekstrak untuk kabilah ini.</Empty>
          )}
        </div>
        <div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Cari di ${tribe.name}…`}
            className="mb-2 w-full rounded-xl border border-krem-300 bg-white px-3 py-2 text-sm outline-none focus:border-hijau-600"
          />
          <div className="scroll-thin max-h-[440px] overflow-auto pr-1">
            {list.slice(0, limit).map((p) => (
              <PersonChip key={p.id} id={p.id} sub={p.cats.length ? p.cats.map((c) => CATEGORY_LABEL[c]).join(', ') : p.comp ? 'sahabat' : undefined} />
            ))}
            {list.length > limit && (
              <button type="button" onClick={() => setLimit((l) => l + 120)} className="mt-2 w-full rounded-xl bg-krem-200 py-2 text-xs font-semibold text-hijau-800">
                Tampilkan lebih banyak ({list.length - limit} lagi)
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

function TribeNetwork({ onSelect }: { onSelect: (t: Tribe) => void }) {
  const { g, tribes, membersByTribe, tribeColorById } = useStore()
  const { nodes, edges } = useMemo(() => {
    const pair = new Map<string, number>()
    for (const e of g.data.edges) {
      if (e.k !== 'spouse') continue
      const a = g.byId.get(e.s)?.tribe
      const b = g.byId.get(e.t)?.tribe
      if (!a || !b || a === b) continue
      const k = [a, b].sort().join('|')
      pair.set(k, (pair.get(k) ?? 0) + 1)
    }
    const used = new Set<string>()
    const edges: GEdge[] = [...pair.entries()].map(([k, n]) => {
      const [a, b] = k.split('|')
      used.add(a)
      used.add(b)
      return { id: k, source: a, target: b, kind: 'alliance', weight: n, label: n > 2 ? String(n) : '' }
    })
    const nodes: GNode[] = g.data.tribes
      .filter((t) => used.has(t.id))
      .map((t) => {
        const n = membersByTribe.get(t.id)?.length ?? 0
        return { id: t.id, label: `${t.name} (${n})`, color: tribeColorById(t.id), size: 18 + Math.sqrt(n) * 3 }
      })
    return { nodes, edges }
  }, [g, membersByTribe, tribeColorById])
  return (
    <div className="card p-4">
      <p className="mb-1 text-sm text-tinta-soft">
        Setiap simpul adalah kabilah/klan (ukuran = jumlah tokoh). Garis emas menunjukkan banyaknya pernikahan silang yang tercatat di antara keduanya — klik simpul
        untuk membuka kabilah.
      </p>
      <GraphCanvas nodes={nodes} edges={edges} onNodeClick={(id) => onSelect(tribes.get(id)!)} height={620} ariaLabel="Peta pernikahan antarkabilah" />
      <div className="mt-2">
        <Legend kinds={['alliance']} />
      </div>
    </div>
  )
}
