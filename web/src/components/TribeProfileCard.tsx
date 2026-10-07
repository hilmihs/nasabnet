import { useBio, type Point } from '../lib/bio'
import { useStore } from '../lib/data'
import type { Tribe } from '../lib/types'
import { useUI } from '../lib/ui'
import { PointRow, SrcChips } from './BioCard'

const MISSING = 'Belum tercatat.'

function Narr({ p }: { p?: Point | null }) {
  if (!p?.t) return <span className="text-tinta-soft/80 italic">{MISSING}</span>
  return (
    <p>
      {p.t}
      <SrcChips src={p.src} basis={p.basis} />
    </p>
  )
}

/** Ten-point profile of a tribe/clan. */
export function TribeProfileCard({ tribe }: { tribe: Tribe }) {
  const { g, membersByTribe, weight, tribes } = useStore()
  const { openProfile } = useUI()
  const bio = useBio()
  const t = bio?.tribes[tribe.id]
  const members = membersByTribe.get(tribe.id) ?? []
  const comps = members.filter((p) => p.comp)
  // notable people: the profile's list resolved to ids, then the most connected companions
  const named = (t?.tokoh ?? []).map((n) => comps.find((p) => p.lat === n)).filter(Boolean) as typeof comps
  const notable = [...new Set([...named, ...[...comps].sort((a, b) => weight(b.id) - weight(a.id))])].slice(0, 10)
  const spouses = new Map<string, number>()
  for (const e of g.data.edges) {
    if (e.k !== 'spouse') continue
    const a = g.byId.get(e.s)?.tribe
    const b = g.byId.get(e.t)?.tribe
    if (a === tribe.id && b && b !== tribe.id) spouses.set(b, (spouses.get(b) ?? 0) + 1)
    if (b === tribe.id && a && a !== tribe.id) spouses.set(a, (spouses.get(a) ?? 0) + 1)
  }
  const allies = [...spouses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div>
      {!bio && <p className="py-2 text-sm text-tinta-soft">Memuat profil…</p>}
      <ol>
        <PointRow n={1} title="Nama & Arti Klan">
          <p>
            <span className="font-semibold">{tribe.name}</span> — <span className="ar">{tribe.ar}</span>. {tribe.desc}
          </p>
          {t?.nama_arti && <Narr p={t.nama_arti} />}
        </PointRow>
        <PointRow n={2} title="Leluhur Utama (al-Jadd al-Akbar)">
          <Narr p={t?.leluhur} />
        </PointRow>
        <PointRow n={3} title="Titik Temu Silsilah">
          <Narr p={t?.titik_temu} />
        </PointRow>
        <PointRow n={4} title="Tingkatan Struktur (Tabaqat)">
          <Narr p={t?.struktur} />
        </PointRow>
        <PointRow n={5} title="Wilayah Asal & Basis Geografis">
          <Narr p={t?.wilayah} />
        </PointRow>
        <PointRow n={6} title="Peran & Kedudukan Sosial">
          <Narr p={t?.peran_sosial} />
        </PointRow>
        <PointRow n={7} title="Aliansi & Perjanjian (Hilf)">
          {t?.hilf?.t && <Narr p={t.hilf} />}
          {allies.length > 0 ? (
            <p>
              Pernikahan silang terbanyak dalam data: {allies.map(([id, n]) => `${tribes.get(id)?.name} (${n})`).join(', ')}.
            </p>
          ) : (
            !t?.hilf?.t && <span className="text-tinta-soft/80 italic">{MISSING}</span>
          )}
        </PointRow>
        <PointRow n={8} title="Tokoh-tokoh Terkenal">
          {notable.length ? (
            <p className="flex flex-wrap gap-1.5">
              {notable.map((p) => (
                <button key={p.id} onClick={() => openProfile(p.id, 'bio')} className="rounded-full bg-hijau-50 px-2.5 py-0.5 text-xs font-medium text-hijau-800 hover:bg-hijau-100">
                  {p.lat}
                </button>
              ))}
            </p>
          ) : (
            <span className="text-tinta-soft/80 italic">{MISSING}</span>
          )}
          <p className="mt-1 text-xs text-tinta-soft">
            {members.length} tokoh dalam data, {comps.length} di antaranya sahabat.
          </p>
        </PointRow>
        <PointRow n={9} title="Dinamika Sejarah">
          <Narr p={t?.dinamika} />
        </PointRow>
        <PointRow n={10} title="Rujukan Kitab Klasik">
          <p>{(t?.rujukan?.length ? t.rujukan : ["Jamharat Ansab al-'Arab (Ibnu Hazm)", "ath-Thabaqat al-Kubra (Ibnu Sa'd)"]).join(' · ')}</p>
        </PointRow>
      </ol>
      {t && (
        <p className="mt-3 text-[11px] leading-relaxed text-tinta-soft">
          Poin bertanda sitasi diringkas dari Jamharat Ansab al-'Arab; poin bertanda “ringkasan umum” belum bersitasi halaman.{' '}
          {t.v ? 'Profil ini sudah diperiksa ulang.' : 'Profil ini belum diperiksa ulang.'}
        </p>
      )}
    </div>
  )
}
