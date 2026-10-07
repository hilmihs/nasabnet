import { useBio, type Point } from '../lib/bio'
import { useStore } from '../lib/data'
import type { ReactNode } from 'react'
import type { Tribe } from '../lib/types'
import { useUI } from '../lib/ui'
import { listId, Section, SrcChips } from './BioCard'

const MISSING = 'Belum tercatat.'

/** Several narrative points joined into one paragraph, each keeping its own citation. */
function Para({ points, lead }: { points: (Point | null | undefined)[]; lead?: ReactNode }) {
  const ps = points.filter((x): x is Point => !!x?.t)
  if (!ps.length && !lead) return null
  return (
    <p>
      {lead}
      {ps.map((x, i) => (
        <span key={i}>
          {(lead || i > 0) && ' '}
          {x.t}
          <SrcChips src={x.src} basis={x.basis} />
        </span>
      ))}
    </p>
  )
}

/** A bare chain of names ("al-Harits bin Fihr bin Malik.") becomes a sentence. */
const ancestorSentence = (x?: Point | null): Point | null | undefined =>
  x?.t && !/\b(adalah|ialah|merupakan|yaitu|bertemu|keturunan|leluhur)\b/i.test(x.t) && x.t.split(/\s+/).length <= 12
    ? { ...x, t: `Leluhur utamanya ialah ${x.t.trim()}` }
    : x

/** A bare place name ("Makkah.") reads better as a sentence. */
const placeSentence = (x?: Point | null): Point | null | undefined =>
  x?.t && x.t.trim().split(/\s+/).length <= 3 ? { ...x, t: `Basis wilayahnya di ${x.t.trim().replace(/\.$/, '')}.` } : x

/** Tribe/clan profile, told in a few themed sections. */
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
      <div>
        <Section title="Asal-usul & Silsilah">
          <Para
            lead={
              <>
                <span className="font-semibold">{tribe.name}</span> (<span className="ar">{tribe.ar}</span>). {tribe.desc}
              </>
            }
            points={[t?.nama_arti]}
          />
          <Para points={[ancestorSentence(t?.leluhur), t?.titik_temu, t?.struktur]} />
        </Section>

        <Section title="Wilayah & Kedudukan">
          <Para points={[placeSentence(t?.wilayah), t?.peran_sosial]} />
          {!t?.wilayah?.t && !t?.peran_sosial?.t && <p className="text-tinta-soft/80 italic">{MISSING}</p>}
        </Section>

        <Section title="Aliansi & Tokoh">
          <Para
            points={[t?.hilf]}
            lead={allies.length > 0 && `Dalam data ini, pernikahan silang paling banyak terjalin dengan ${listId(allies.map(([id, n]) => `${tribes.get(id)?.name} (${n})`))}.`}
          />
          {notable.length > 0 && <p>Tokoh-tokoh terkenalnya antara lain:</p>}
          {notable.length > 0 && (
            <p className="flex flex-wrap gap-1.5">
              {notable.map((p) => (
                <button key={p.id} onClick={() => openProfile(p.id, 'bio')} className="rounded-full bg-hijau-50 px-2.5 py-0.5 text-xs font-medium text-hijau-800 hover:bg-hijau-100">
                  {p.lat}
                </button>
              ))}
            </p>
          )}
          <p className="mt-1 text-xs text-tinta-soft">
            {members.length} tokoh dalam data, {comps.length} di antaranya sahabat.
          </p>
        </Section>

        <Section title="Perjalanan Sejarah">
          {t?.dinamika?.t ? <Para points={[t.dinamika]} /> : <p className="text-tinta-soft/80 italic">{MISSING}</p>}
        </Section>

        <Section title="Rujukan">
          <p className="text-sm">{(t?.rujukan?.length ? t.rujukan : ["Jamharat Ansab al-'Arab (Ibnu Hazm)", "ath-Thabaqat al-Kubra (Ibnu Sa'd)"]).join(' · ')}</p>
        </Section>
      </div>
      {t && (
        <p className="mt-3 text-[11px] leading-relaxed text-tinta-soft">
          Kalimat bertanda sitasi diringkas dari Jamharat Ansab al-'Arab; yang bertanda † adalah ringkasan umum yang belum bersitasi halaman.{' '}
          {t.v ? 'Profil ini sudah diperiksa ulang.' : 'Profil ini belum diperiksa ulang.'}
        </p>
      )}
    </div>
  )
}
