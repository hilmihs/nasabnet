import { useEffect, useMemo } from 'react'
import { Empty, PersonChip, SectionTitle } from '../components/bits'
import { Icon } from '../components/Icon'
import { PersonPicker } from '../components/PersonPicker'
import { normAr } from '../lib/arabic'
import { useStore } from '../lib/data'
import { relIds } from '../lib/graph'
import { pushHistory, toggleBookmark, useSaved } from '../lib/store'
import type { Person } from '../lib/types'
import { useUI } from '../lib/ui'

/** Ancestors that mark where a clan or the larger tribe branches off. */
const CLAN_POINTS_RAW: Record<string, string> = {
  'هاشم|عبد مناف': 'Pangkal Bani Hasyim',
  'عبد المطلب|هاشم': 'Kakek Nabi ﷺ',
  'عبد شمس|عبد مناف': 'Pangkal Bani Abdi Syams',
  'امية|عبد شمس': 'Pangkal Bani Umayyah',
  'نوفل|عبد مناف': 'Pangkal Bani Naufal',
  'المطلب|عبد مناف': 'Pangkal Bani al-Muththalib',
  'عبد مناف|قصي': 'Titik temu Bani Abdi Manaf',
  'قصي|كلاب': 'Titik temu Quraisy al-Bithah (Qushay)',
  'اسد|عبد العزي': 'Pangkal Bani Asad',
  'عبد الدار|قصي': 'Pangkal Bani Abdid-Dar',
  'زهره|كلاب': 'Pangkal Bani Zuhrah',
  'كلاب|مره': 'Titik temu Kilab (Zuhrah & Qushay)',
  'تيم|مره': 'Pangkal Bani Taim',
  'مخزوم|يقظه': 'Pangkal Bani Makhzum',
  'مره|كعب': 'Titik temu Murrah (Taim, Makhzum, Kilab)',
  'عدي|كعب': "Pangkal Bani 'Adi",
  'كعب|لؤي': "Titik temu Ka'b ('Adi, Murrah, Hushaish)",
  'سهم|عمرو': 'Pangkal Bani Sahm',
  'جمح|عمرو': 'Pangkal Bani Jumah',
  'لؤي|غالب': "Titik temu Lu'ay",
  'فهر|مالك': 'Pangkal Quraisy (Fihr)',
  'كنانه|خزيمه': 'Pangkal Kinanah',
  'مضر|نزار': 'Pangkal Mudhar',
  'عدنان|': 'Adnan — leluhur Arab utara',
  'الخزرج|حارثه': 'Pangkal Khazraj',
  'الاوس|حارثه': 'Pangkal Aus',
  'النجار|ثعلبه': 'Pangkal Bani an-Najjar',
  'عبد الاشهل|جشم': 'Pangkal Bani Abdil Asyhal',
  'الازد|': 'Al-Azd — leluhur Anshar',
}
const CLAN_POINTS = Object.fromEntries(
  Object.entries(CLAN_POINTS_RAW).map(([k, v]) => [k.split('|').map((x) => (x ? normAr(x) : '')).join('|'), v]),
)

interface Rung {
  ar: string
  id?: string
  canon?: boolean
  mark?: string
  prophet?: boolean
}

function prophetKeys(nabi: Person | undefined) {
  const keys = new Set<string>()
  if (!nabi) return keys
  const chain = nabi.line.map((l) => normAr(l.ar))
  for (let i = 0; i < chain.length; i++) keys.add(`${chain[i]}|${chain[i + 1] ?? ''}`)
  return keys
}

export function LineageView() {
  const { g, tribes } = useStore()
  const { route, go, openProfile } = useUI()
  const { isBookmarked } = useSaved()
  const id = route.params.p && g.byId.has(route.params.p) ? route.params.p : null
  const compare = route.params.c && g.byId.has(route.params.c) ? route.params.c : null
  const p = id ? g.byId.get(id) : undefined
  const nabiKeys = useMemo(() => prophetKeys(g.byId.get('nabi')), [g])

  useEffect(() => {
    if (p) pushHistory({ kind: 'lineage', ref: p.id, label: `Silsilah ${p.lat}` })
  }, [p])

  const rungs = (x: Person): Rung[] => {
    const chain = x.line.map((l) => ({ ...l, n: normAr(l.ar) }))
    return chain.map((l, i) => {
      const key = `${l.n}|${chain[i + 1]?.n ?? ''}`
      return { ar: l.ar, id: l.id, canon: (l as { canon?: boolean }).canon, mark: CLAN_POINTS[key], prophet: x.id !== 'nabi' && nabiKeys.has(key) }
    })
  }

  return (
    <div>
      <SectionTitle kicker="Vertical Lineage Viewer" title="Silsilah Vertikal">
        Telusuri garis keturunan lurus seorang sahabat: ke atas melalui ayah, kakek, buyut, hingga titik temu klan utama (Quraisy, Abdu Manaf, Aus/Khazraj…), dan ke
        bawah melalui anak-cucu yang tercatat. Mata rantai yang ditandai emas juga merupakan leluhur Nabi ﷺ.
      </SectionTitle>

      <div className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <PersonPicker label="Tokoh" value={id} onChange={(v) => go('silsilah', { p: v ?? '', c: compare ?? '' })} />
        <PersonPicker label="Bandingkan dengan (opsional)" value={compare} onChange={(v) => go('silsilah', { p: id ?? '', c: v ?? '' })} />
      </div>

      {!p && (
        <Empty>
          Pilih tokoh, misalnya{' '}
          {['n4677', 'n4500', 'n4307', 'n2065'].map((pid, i) => (
            <span key={pid}>
              {i > 0 && ', '}
              <QuickPick id={pid} />
            </span>
          ))}
          .
        </Empty>
      )}

      {p && (
        <div className={`grid gap-6 ${compare ? 'lg:grid-cols-2' : ''}`}>
          {[p, ...(compare ? [g.byId.get(compare)!] : [])].map((x) => (
            <div key={x.id} className="card min-w-0 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">{x.tribe ? tribes.get(x.tribe)?.name : 'Silsilah'}</p>
                  <h2 className="font-display text-2xl font-semibold text-hijau-900">{x.lat}</h2>
                </div>
                {x.id === p.id && (
                  <button
                    type="button"
                    onClick={() => toggleBookmark({ kind: 'lineage', ref: x.id, label: `Silsilah ${x.lat}` })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${isBookmarked('lineage', x.id) ? 'border-emas-500 bg-emas-100 text-emas-700' : 'border-krem-300 bg-white text-hijau-800'}`}
                  >
                    <Icon name="bookmark" className="h-4 w-4" filled={isBookmarked('lineage', x.id)} /> Simpan
                  </button>
                )}
              </div>
              <LineageColumn person={x} rungs={rungs(x)} onOpen={openProfile} />
              <Descendants id={x.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuickPick({ id }: { id: string }) {
  const { g } = useStore()
  const { go } = useUI()
  const p = g.byId.get(id)
  if (!p) return null
  return (
    <button className="font-semibold text-hijau-700 hover:underline" onClick={() => go('silsilah', { p: id })}>
      {p.lat}
    </button>
  )
}

function LineageColumn({ person, rungs, onOpen }: { person: Person; rungs: Rung[]; onOpen: (id: string) => void }) {
  const top = [...rungs].reverse()
  if (!rungs.length) return <Empty>Rantai nasab tidak tercatat di sumber.</Empty>
  return (
    <ol className="relative ml-3 border-l-2 border-hijau-100 pl-5">
      {top.map((r, i) => {
        const gen = rungs.length - i
        return (
          <li key={i} className="relative pb-3">
            <span
              className={`absolute top-1.5 -left-[29px] h-3.5 w-3.5 rounded-full border-2 ${r.prophet ? 'border-emas-500 bg-emas-300' : r.id ? 'border-hijau-700 bg-hijau-600' : 'border-hijau-600/50 bg-krem-50'}`}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              {r.id ? (
                <button onClick={() => onOpen(r.id!)} className="ar text-lg font-bold text-hijau-800 hover:underline">
                  {r.ar}
                </button>
              ) : (
                <span className={`ar text-lg ${r.canon ? 'text-tinta-soft' : 'text-tinta'}`}>{r.ar}</span>
              )}
              <span className="text-[11px] text-tinta-soft">{gen === 1 ? 'ayah' : gen === 2 ? 'kakek' : gen === 3 ? 'buyut' : `generasi ke-${gen}`}</span>
              {r.canon && <span className="text-[10px] text-tinta-soft italic">(rangkaian baku nasab)</span>}
            </div>
            {(r.mark || r.prophet) && (
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                {r.mark && <span className="rounded-full bg-hijau-800 px-2 py-0.5 text-[10px] font-semibold text-emas-300">{r.mark}</span>}
                {r.prophet && <span className="rounded-full bg-emas-100 px-2 py-0.5 text-[10px] font-semibold text-emas-700">leluhur Nabi ﷺ juga</span>}
              </div>
            )}
          </li>
        )
      })}
      <li className="relative">
        <span className="absolute top-2 -left-[31px] h-[18px] w-[18px] rounded-full border-4 border-emas-400 bg-hijau-800" aria-hidden="true" />
        <button onClick={() => onOpen(person.id)} className="rounded-xl bg-hijau-800 px-3 py-2 text-left text-krem-50 shadow">
          <span className="ar block text-xl">{person.ar}</span>
          <span className="block text-xs text-emas-300">{person.lat}</span>
        </button>
      </li>
    </ol>
  )
}

function Descendants({ id }: { id: string }) {
  const { g } = useStore()
  const kids = relIds(g, id, 'child')
  if (!kids.length) return null
  return (
    <div className="mt-5 border-t border-krem-200 pt-4">
      <h3 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-emas-700 uppercase">Keturunan tercatat ({kids.length} anak)</h3>
      <div className="space-y-2">
        {kids.map((k) => {
          const grand = relIds(g, k, 'child')
          return (
            <div key={k} className="rounded-xl border border-krem-200 bg-white/60 p-1">
              <PersonChip id={k} />
              {grand.length > 0 && (
                <div className="ml-8 grid border-l border-dashed border-krem-300 pl-2 sm:grid-cols-2">
                  {grand.map((c) => (
                    <PersonChip key={c} id={c} compact />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
