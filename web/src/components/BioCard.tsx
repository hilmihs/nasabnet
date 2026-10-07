import type { ReactNode } from 'react'
import { citationUrl, useBio, type Point } from '../lib/bio'
import { useStore } from '../lib/data'
import { inLaws, relIds, siblings } from '../lib/graph'
import { CATEGORY_LABEL, type Category, type Person, type Tribe } from '../lib/types'
import { useUI } from '../lib/ui'

const MISSING = 'Belum tercatat dalam kutipan sumber yang dipakai.'

/** Small citation note placed at the end of a paragraph. */
export function SrcChips({ src, basis }: { src?: string[]; basis?: Point['basis'] }) {
  if (basis === 'umum')
    return (
      <sup className="ml-0.5 cursor-help text-[11px] font-semibold text-emas-700" title="Ringkasan umum, belum bersitasi halaman">
        †
      </sup>
    )
  if (!src?.length) return null
  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-x-1.5 align-middle text-[10px] font-medium text-tinta-soft">
      <span aria-hidden="true">ⓘ</span>
      {[...new Set(src)].map((s, i) => {
        const url = citationUrl(s)
        return (
          <span key={s}>
            {i > 0 && '· '}
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="text-hijau-700 underline decoration-hijau-600/30 underline-offset-2 hover:decoration-hijau-700">
                {s}
              </a>
            ) : (
              s
            )}
          </span>
        )
      })}
    </span>
  )
}

/** One themed part of a biography or tribe profile: a heading and flowing paragraphs. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-krem-200 py-4 first:pt-2 last:border-0">
      <h4 className="flex items-center gap-2 font-display text-lg font-semibold text-hijau-900">
        <span className="h-4 w-1 rounded-full bg-emas-500" aria-hidden="true" />
        {title}
      </h4>
      <div className="mt-1.5 space-y-2 text-[15px] leading-relaxed text-tinta">{children}</div>
    </section>
  )
}

const Missing = () => <p className="text-tinta-soft/80 italic">{MISSING}</p>

function Narr({ p }: { p?: Point | null }) {
  if (!p?.t) return null
  return (
    <p>
      {p.t}
      <SrcChips src={p.src} basis={p.basis} />
    </p>
  )
}

/** "A", "A dan B", "A, B, dan C" — trimmed to `max` names. */
export function listId(items: string[], max = 6): string {
  const l = items.filter(Boolean)
  if (l.length > max) return `${l.slice(0, max).join(', ')}, serta ${l.length - max} lainnya`
  if (l.length <= 1) return l[0] ?? ''
  if (l.length === 2) return `${l[0]} dan ${l[1]}`
  return `${l.slice(0, -1).join(', ')}, dan ${l[l.length - 1]}`
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const trimDot = (s: string) => s.trim().replace(/[.。]+$/, '')

const GROUP_PHRASE: Record<Tribe['group'], string> = {
  quraisy: 'salah satu klan Quraisy di Makkah',
  anshar: 'kabilah Anshar di Madinah',
  arab: 'salah satu kabilah Arab',
  ajam: 'kalangan non-Arab',
}

const CAT_PHRASE: Record<Category, string> = {
  khulafa: 'Khulafaur Rasyidin',
  asyarah: "sepuluh sahabat yang dijamin surga (al-'Asyarah)",
  ummahat: 'Ummahatul Mukminin',
  ahlulbait: 'Ahlulbait Nabi ﷺ',
  kerabat: 'kerabat dekat Nabi ﷺ',
  muhajirin: 'kaum Muhajirin',
  anshar: 'kaum Anshar',
  badar: 'Ahlu Badar',
}

/** "lahir …, wafat pada 23 H dalam usia 63 tahun, dan dimakamkan di …" */
function lifeSentence(id: NonNullable<ReturnType<typeof useBio>>['persons'][string]['identitas'], fallbackDeath?: string) {
  const parts: string[] = []
  if (id?.lahir) parts.push(`lahir ${lower(trimDot(id.lahir))}`)
  const wafat = id?.wafat ?? fallbackDeath
  if (wafat) {
    const w = trimDot(wafat)
    parts.push(`${/^\d/.test(w) ? 'wafat pada' : 'wafat'} ${lower(w)}${id?.umur ? ` dalam usia ${lower(trimDot(id.umur))}` : ''}`)
  } else if (id?.umur) parts.push(`berusia ${lower(trimDot(id.umur))}`)
  if (id?.makam) {
    const m = trimDot(id.makam)
    parts.push(/^di\s/i.test(m) ? `dimakamkan ${lower(m)}` : `dimakamkan di ${m}`)
  }
  return parts.length ? `Beliau ${listId(parts, 9)}.` : ''
}

/** Biography in a few themed sections: dataset facts and extracted narrative woven into plain Indonesian sentences. */
export function BioCard({ p }: { p: Person }) {
  const { g, tribes } = useStore()
  const { go, openProfile } = useUI()
  const bio = useBio()
  const b = bio?.persons[p.id]
  const t = p.tribe ? tribes.get(p.tribe) : undefined
  const law = inLaws(g, p.id)
  const parents = relIds(g, p.id, 'parent')
  const father = parents.find((x) => g.byId.get(x)?.g === 'm')
  const mother = parents.find((x) => g.byId.get(x)?.g === 'f')
  const uncles = father ? siblings(g, father) : []
  const sibs = siblings(g, p.id)
  const patrons = relIds(g, p.id, 'patron')
  const clients = relIds(g, p.id, 'client')
  const muakhah = relIds(g, p.id, 'muakhah')
  const lat = (ids: string[]) => ids.map((x) => g.byId.get(x)?.lat ?? '')
  // own name (ism) from the full nasab — the display name may be a kunya ("أبو بكر الصديق")
  const ism = (p.full ?? p.ar).split(/[:،,]|\s+بن(?:ت)?\s/)[0].trim()
  const chain = [ism, ...p.line.map((l) => l.ar)]
  const top = p.line[p.line.length - 1]?.ar
  const id = b?.identitas
  const life = lifeSentence(id, p.death)
  const fem = p.g === 'f'
  const sources = p.src.map((s) => s.t)

  return (
    <div>
      {!bio && <p className="py-2 text-sm text-tinta-soft">Memuat biografi…</p>}
      {bio && !b && (
        <p className="mb-2 rounded-lg bg-krem-100 px-3 py-2 text-xs text-tinta-soft">
          Biografi naratif baru tersedia untuk ±150 sahabat utama. Uraian di bawah disusun dari data nasab & relasi yang terkumpul.
        </p>
      )}
      <div>
        <Section title="Nasab & Asal-usul">
          <p>
            <span className="font-semibold">{p.lat}</span> (<span className="ar">{p.ar}</span>)
            {p.kunya ? (
              <>
                , berkunyah <span className="ar">{p.kunya}</span>.
              </>
            ) : (
              '.'
            )}{' '}
            {life || <span className="text-tinta-soft/80 italic">Tahun lahir dan wafatnya belum tercatat dalam kutipan sumber.</span>}
            {life && <SrcChips src={id?.src ?? (p.death ? ['Turath rawi'] : undefined)} />}
          </p>
          {chain.length > 1 ? (
            <>
              <p className="ar text-[16px] leading-loose">
                {chain[0]}
                {chain.slice(1).map((n, i) => `${i === 0 && fem ? ' بنت ' : ' بن '}${n.replace(/^أبو\s/, 'أبي ')}`).join('')}
              </p>
              <p className="text-sm text-tinta-soft">
                Garis ayahnya tercatat {p.line.length} generasi ke atas{top ? <>, bersambung hingga <span className="ar">{top}</span></> : ''}.{' '}
                <button className="font-semibold text-hijau-700 hover:underline" onClick={() => go('silsilah', { p: p.id })}>
                  Lihat silsilah vertikal →
                </button>
              </p>
            </>
          ) : (
            <Missing />
          )}
          <p>
            {t ? (
              <>
                {fem ? 'Ia' : 'Beliau'} berasal dari{' '}
                <button className="font-medium text-hijau-700 hover:underline" onClick={() => go('kabilah', { t: t.id, tab: 'profil' })}>
                  {t.name}
                </button>{' '}
                (<span className="ar">{t.ar}</span>){t.id !== 'quraisy' && t.id !== 'anshar' ? `, ${GROUP_PHRASE[t.group]}` : ''}.
              </>
            ) : (
              'Kabilahnya belum tercatat dalam data.'
            )}
            {p.cats.length > 0 && !b?.kabilah_tabaqat && ` Beliau termasuk ${listId(p.cats.map((c) => CAT_PHRASE[c] ?? CATEGORY_LABEL[c]))}.`}
          </p>
          <Narr p={b?.kabilah_tabaqat} />
          {p.nisba && (
            <p>
              Dalam kitab-kitab rijal beliau dinisbatkan sebagai <span className="ar">{p.nisba}</span>
              {p.place ? (
                <>
                  , dan tercatat pernah bermukim di <span className="ar">{p.place}</span>.
                </>
              ) : (
                '.'
              )}
            </p>
          )}
          <Narr p={b?.nisbah_rihlah} />
        </Section>

        <Section title="Kiprah & Kedudukan">
          {p.laqab && (
            <p>
              Beliau dikenal dengan julukan <span className="ar">{p.laqab}</span>.
            </p>
          )}
          <Narr p={b?.laqab_profesi} />
          <Narr p={b?.peran} />
          {b?.syaraf ? (
            <Narr p={b.syaraf} />
          ) : (
            <p className="text-tinta-soft">
              {p.line.length > 0 ? `Nasabnya tercatat bersambung ${p.line.length} generasi ke atas dalam sumber.` : MISSING}
              {p.rank && (
                <>
                  {' '}
                  Ibnu Hajar menilai martabat periwayatannya: <span className="ar">{p.rank}</span>.
                </>
              )}
            </p>
          )}
          {b?.catatan && (
            <p className="text-sm text-tinta-soft">
              {typeof b.catatan === 'string' ? b.catatan : b.catatan.t}
              {typeof b.catatan !== 'string' && <SrcChips src={b.catatan.src} />}
            </p>
          )}
        </Section>

        <Section title="Keluarga & Pernikahan">
          {law.spouses.length > 0 ? (
            <p>
              {fem ? `Ia menikah dengan ${listId(lat(law.spouses))}.` : `Beliau menikahi ${listId(lat(law.spouses))}.`}
              {law.parentsInLaw.length > 0 && ` Dari pernikahan itu beliau bermertuakan ${listId(lat(law.parentsInLaw), 4)}.`}
              {law.childrenInLaw.length > 0 && ` Menantunya antara lain ${listId(lat(law.childrenInLaw), 4)}`}
              {law.childrenInLaw.length > 0 && (law.coInLaws.length > 0 ? `, sehingga beliau berbesan dengan ${listId(lat(law.coInLaws), 4)}.` : '.')}{' '}
              <button className="text-sm font-semibold text-hijau-700 hover:underline" onClick={() => go('nikah', { p: p.id })}>
                Lihat jejaring pernikahan →
              </button>
            </p>
          ) : (
            <p className="text-tinta-soft/80 italic">Belum ada pernikahan yang tercatat dalam data.</p>
          )}
          {muakhah.length > 0 && <p>Nabi ﷺ mempersaudarakannya (mu'akhah) dengan {listId(lat(muakhah))}.</p>}
          <Narr p={b?.hilf} />
          {sibs.length + uncles.length + patrons.length + clients.length + (mother ? 1 : 0) > 0 && (
            <p>
              {mother && `Ibunya adalah ${g.byId.get(mother)?.lat}. `}
              {sibs.length > 0 && `Saudara-saudaranya yang tercatat: ${listId(lat(sibs), 8)}. `}
              {uncles.length > 0 && `Dari pihak ayah, paman dan bibinya antara lain ${listId(lat(uncles), 6)}. `}
              {patrons.length > 0 && `Beliau adalah maula (terikat wala') kepada ${listId(lat(patrons))}. `}
              {clients.length > 0 && `Maula yang terikat wala' kepadanya: ${listId(lat(clients))}.`}
            </p>
          )}
        </Section>

        <Section title="Rujukan">
          <ul className="list-disc space-y-0.5 pl-4 text-sm">
            {p.src.map((s) => (
              <li key={s.t}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-hijau-700 hover:underline">
                    {s.t}
                  </a>
                ) : (
                  s.t
                )}
              </li>
            ))}
            {[...new Set(Object.values(b ?? {}).flatMap((v) => (v && typeof v === 'object' && 'src' in v ? ((v as Point).src ?? []) : [])))]
              .filter((s) => s !== 'Turath rawi' && !sources.some((x) => x.includes(s)))
              .map((s) => {
                const url = citationUrl(s)
                return (
                  <li key={s}>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="text-hijau-700 hover:underline">
                        {s}
                      </a>
                    ) : (
                      s
                    )}
                  </li>
                )
              })}
          </ul>
          {father && (
            <button className="text-sm font-semibold text-hijau-700 hover:underline" onClick={() => openProfile(father, 'bio')}>
              Baca biografi ayahnya →
            </button>
          )}
        </Section>
      </div>
      {b && (
        <p className="mt-3 text-[11px] leading-relaxed text-tinta-soft">
          {b.v
            ? 'Uraian naratif diringkas dari kutipan kitab yang ditautkan dan sudah diperiksa ulang terhadap kutipan tersebut; tanda † = ringkasan umum yang belum bersitasi halaman.'
            : 'Uraian naratif diringkas otomatis dari kutipan kitab yang ditautkan dan belum diperiksa ulang; tanda † = ringkasan umum yang belum bersitasi halaman.'}{' '}
          Selalu rujuk teks aslinya sebelum mengutip.
        </p>
      )}
    </div>
  )
}
