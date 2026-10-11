import { toBullets, useBio, type Point } from '../lib/bio'
import { useStore } from '../lib/data'
import type { Tribe } from '../lib/types'
import { useUI } from '../lib/ui'
import { Accordion, ArBlock, Bullets, Li, Missing, PointItems, Rich, Section, SubHead, TribeRoles } from './Prose'

/** A bare chain of names ("al-Harits bin Fihr bin Malik.") reads better with a lead. */
const ancestorPoint = (x?: Point | null): Point | null | undefined =>
  x?.t && !/\b(adalah|ialah|merupakan|yaitu|bertemu|keturunan|leluhur)\b/i.test(x.t) && x.t.split(/\s+/).length <= 12
    ? { ...x, t: `Leluhur utama: ${x.t.trim()}` }
    : x

/** Tribe/clan profile in themed sections of short bullets. */
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
  const refs = t?.rujukan?.length ? t.rujukan : ["Jamharat Ansab al-'Arab (Ibnu Hazm)", "ath-Thabaqat al-Kubra (Ibnu Sa'd)"]

  return (
    <div>
      {!bio && <p className="py-2 text-sm text-tinta-soft">Memuat profil…</p>}
      <Section title="Asal-usul & Silsilah" id={`tp-asal-${tribe.id}`}>
        <Bullets>
          <Li label="Nama">
            <strong className="font-semibold text-hijau-900">{tribe.name}</strong>
            <ArBlock>{tribe.ar}</ArBlock>
          </Li>
          {toBullets(tribe.desc).map((x, i) => (
            <Li key={i}>
              <Rich text={x} />
            </Li>
          ))}
          <PointItems p={t?.nama_arti} />
          <PointItems p={ancestorPoint(t?.leluhur)} />
          <PointItems p={t?.titik_temu} />
          <PointItems p={t?.struktur} />
        </Bullets>
      </Section>

      <Section title="Lokasi & Peran Strategis" id={`tp-peran-${tribe.id}`}>
        <TribeRoles t={t} wilayah={t?.wilayah} />
        {t?.peran_sosial?.t && (
          <>
            <SubHead>Kedudukan umum</SubHead>
            <Bullets>
              <PointItems p={t.peran_sosial} />
            </Bullets>
          </>
        )}
      </Section>

      <Section title="Aliansi & Tokoh" id={`tp-tokoh-${tribe.id}`}>
        <Bullets>
          {allies.length > 0 && (
            <Li label="Pernikahan silang terbanyak (dalam data)">
              {allies.map(([id, n], i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <strong className="font-semibold text-hijau-900">{tribes.get(id)?.name}</strong> ({n})
                </span>
              ))}
            </Li>
          )}
          <PointItems p={t?.hilf} />
          <Li label="Jumlah dalam data">
            {members.length} tokoh, {comps.length} di antaranya sahabat
          </Li>
        </Bullets>
        {notable.length > 0 && (
          <>
            <SubHead>Tokoh terkenal</SubHead>
            <div className="flex flex-wrap gap-2">
              {notable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProfile(p.id, 'bio')}
                  className="inline-flex min-h-11 items-center rounded-full border border-hijau-100 bg-hijau-50 px-3.5 text-sm font-medium text-hijau-800 hover:border-hijau-600 hover:bg-hijau-100"
                >
                  {p.lat}
                </button>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title="Perjalanan Sejarah" id={`tp-sejarah-${tribe.id}`}>
        {t?.dinamika?.t ? (
          <Bullets>
            <PointItems p={t.dinamika} />
          </Bullets>
        ) : (
          <Missing>Belum tercatat.</Missing>
        )}
      </Section>

      <div className="mt-2">
        <Accordion title="Rujukan" count={refs.length}>
          <Bullets>
            {refs.map((r) => (
              <Li key={r}>{r}</Li>
            ))}
          </Bullets>
          <ul className="mt-3 list-disc space-y-0.5 border-t border-krem-200 pt-3 pl-4 text-xs text-tinta-soft">
            <li>Poin bersitasi diringkas dari halaman kitab yang ditautkan; lokasi & peran strategis dicocokkan dengan teks Arabnya.</li>
            <li>Label "umum" = ringkasan umum yang belum bersitasi halaman kitab.</li>
            {t && <li>{t.v ? 'Profil ini sudah diperiksa ulang.' : 'Profil ini belum diperiksa ulang.'}</li>}
          </ul>
        </Accordion>
      </div>
    </div>
  )
}
