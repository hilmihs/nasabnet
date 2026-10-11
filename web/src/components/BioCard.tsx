import { isArabic } from '../lib/arabic'
import { citationUrl, toBullets, useBio, type Point } from '../lib/bio'
import { useStore } from '../lib/data'
import { inLaws, relIds, siblings } from '../lib/graph'
import { CATEGORY_LABEL, type Category, type Person, type Tribe } from '../lib/types'
import { useUI } from '../lib/ui'
import { Icon } from './Icon'
import { Accordion, ActionChip, ArBlock, ArInline, Bullets, Chips, Li, Missing, NameList, Notice, PointItems, Rich, Section, SrcChips, SubHead, TribeRoles } from './Prose'

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

const trimDot = (s: string) => s.trim().replace(/[.。]+$/, '')

/** A value that may be Arabic (dataset) or Indonesian (extracted narrative). */
const Val = ({ v }: { v: string }) => (isArabic(v) ? <ArInline>{trimDot(v)}</ArInline> : <Rich text={trimDot(v)} />)

/** Biography in themed sections of short bullets: dataset facts and extracted narrative. */
export function BioCard({ p }: { p: Person }) {
  const { g, tribes } = useStore()
  const { go, openProfile } = useUI()
  const bio = useBio()
  const b = bio?.persons[p.id]
  const t = p.tribe ? tribes.get(p.tribe) : undefined
  const tp = t ? bio?.tribes[t.id] : undefined
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
  const fem = p.g === 'f'
  const wafat = id?.wafat ?? p.death
  const life = [
    id?.lahir && { k: 'Lahir', v: id.lahir },
    wafat && { k: 'Wafat', v: wafat, extra: id?.umur ? `usia ${trimDot(id.umur)}` : undefined },
    !wafat && id?.umur && { k: 'Usia', v: id.umur },
    id?.makam && { k: 'Makam', v: id.makam },
  ].filter(Boolean) as { k: string; v: string; extra?: string }[]
  const lifeSrc = id?.src ?? (p.death ? ['Turath rawi'] : undefined)
  const catatan: Point | undefined = typeof b?.catatan === 'string' ? { t: b.catatan } : (b?.catatan ?? undefined)
  const hasKiprah = p.laqab || b?.laqab_profesi || b?.peran || b?.syaraf || p.line.length > 0 || p.rank || catatan

  return (
    <div>
      {!bio && <p className="py-2 text-sm text-tinta-soft">Memuat biografi…</p>}
      {bio && !b && (
        <div className="mb-2">
          <Notice>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Biografi naratif dari kitab baru tersedia untuk <strong>{Object.keys(bio.persons).length.toLocaleString('id-ID')} sahabat</strong>; tokoh ini belum termasuk.
              </li>
              <li>Uraian di bawah disusun dari data nasab & relasi yang terkumpul.</li>
            </ul>
          </Notice>
        </div>
      )}

      <Section title="Nasab & Asal-usul" id="bio-nasab">
        <Bullets>
          <Li label="Nama">
            <strong className="font-semibold text-hijau-900">{p.lat}</strong>
            <ArBlock>{p.ar}</ArBlock>
          </Li>
          {p.kunya && (
            <Li label="Kunyah">
              <ArBlock>{trimDot(p.kunya)}</ArBlock>
            </Li>
          )}
          {life.length > 0 ? (
            life.map((x, i) => (
              <Li key={x.k} label={x.k}>
                <Val v={x.v} />
                {x.extra && <> ({x.extra})</>}
                {i === life.length - 1 && <SrcChips src={lifeSrc} />}
              </Li>
            ))
          ) : (
            <Li>
              <Missing>Tahun lahir dan wafatnya belum tercatat dalam kutipan sumber.</Missing>
            </Li>
          )}
          {chain.length > 1 ? (
            <>
              <Li label="Nasab">
                <ArBlock>
                  {chain[0]}
                  {chain
                    .slice(1)
                    .map((n, i) => `${i === 0 && fem ? ' بنت ' : ' بن '}${n.replace(/^أبو\s/, 'أبي ')}`)
                    .join('')}
                </ArBlock>
              </Li>
              <Li>
                Garis ayah tercatat <strong className="font-semibold text-hijau-900">{p.line.length} generasi</strong> ke atas
                {top && (
                  <>
                    , bersambung hingga <ArInline>{top}</ArInline>
                  </>
                )}
              </Li>
            </>
          ) : (
            <Li label="Nasab">
              <Missing />
            </Li>
          )}
          {p.cats.length > 0 && !b?.kabilah_tabaqat && (
            <Li label="Golongan">
              <NameList names={p.cats.map((c) => CAT_PHRASE[c] ?? CATEGORY_LABEL[c])} />
            </Li>
          )}
          <PointItems p={b?.kabilah_tabaqat} />
          {p.nisba && (
            <Li label="Nisbah">
              <ArBlock>{trimDot(p.nisba)}</ArBlock>
            </Li>
          )}
          {p.place && (
            <Li label="Domisili">
              <ArBlock>{trimDot(p.place)}</ArBlock>
            </Li>
          )}
          <PointItems p={b?.nisbah_rihlah} />
        </Bullets>
        {chain.length > 1 && (
          <Chips>
            <ActionChip icon="tree" onClick={() => go('silsilah', { p: p.id })}>
              Lihat silsilah vertikal
            </ActionChip>
          </Chips>
        )}
      </Section>

      <Section title="Profil Kabilah" id="bio-kabilah">
        {t ? (
          <>
            <Bullets>
              <Li label="Kabilah">
                <strong className="font-semibold text-hijau-900">{t.name}</strong>
                {t.id !== 'quraisy' && t.id !== 'anshar' && (
                  <>
                    {' — '}
                    <Rich text={GROUP_PHRASE[t.group]} />
                  </>
                )}
                <ArBlock>{t.ar}</ArBlock>
              </Li>
              {toBullets(t.desc).map((x, i) => (
                <Li key={i}>
                  <Rich text={x} />
                </Li>
              ))}
            </Bullets>
            <SubHead>Lokasi, kedudukan & peran strategis</SubHead>
            <TribeRoles t={tp} wilayah={tp?.wilayah} />
            <Chips>
              <ActionChip icon="tribes" onClick={() => go('kabilah', { t: t.id, tab: 'profil' })}>
                Profil lengkap {t.name}
              </ActionChip>
            </Chips>
          </>
        ) : (
          <Missing>Kabilahnya belum tercatat dalam data.</Missing>
        )}
      </Section>

      <Section title="Kiprah & Kedudukan" id="bio-kiprah">
        {hasKiprah ? (
          <Bullets>
            {p.laqab && (
              <Li label="Julukan (laqab)">
                <ArBlock>{trimDot(p.laqab)}</ArBlock>
              </Li>
            )}
            <PointItems p={b?.laqab_profesi} />
            <PointItems p={b?.peran} />
            {b?.syaraf ? (
              <PointItems p={b.syaraf} />
            ) : (
              <>
                {p.line.length > 0 && <Li>Nasabnya tercatat bersambung {p.line.length} generasi ke atas dalam sumber.</Li>}
                {p.rank && (
                  <Li label="Martabat periwayatan (Ibnu Hajar)">
                    <ArBlock>{trimDot(p.rank)}</ArBlock>
                  </Li>
                )}
              </>
            )}
            <PointItems p={catatan} />
          </Bullets>
        ) : (
          <Missing />
        )}
      </Section>

      <Section title="Keluarga & Pernikahan" id="bio-keluarga">
        <Bullets>
          {law.spouses.length > 0 ? (
            <>
              <Li label={fem ? 'Suami' : 'Istri'}>
                <NameList names={lat(law.spouses)} />
              </Li>
              {law.parentsInLaw.length > 0 && (
                <Li label="Mertua">
                  <NameList names={lat(law.parentsInLaw)} max={4} />
                </Li>
              )}
              {law.childrenInLaw.length > 0 && (
                <Li label="Menantu">
                  <NameList names={lat(law.childrenInLaw)} max={4} />
                </Li>
              )}
              {law.childrenInLaw.length > 0 && law.coInLaws.length > 0 && (
                <Li label="Besan">
                  <NameList names={lat(law.coInLaws)} max={4} />
                </Li>
              )}
            </>
          ) : (
            <Li>
              <Missing>Belum ada pernikahan yang tercatat dalam data.</Missing>
            </Li>
          )}
          {muakhah.length > 0 && (
            <Li label="Saudara mu'akhah">
              Dipersaudarakan Nabi ﷺ dengan <NameList names={lat(muakhah)} />
            </Li>
          )}
          <PointItems p={b?.hilf} />
          {mother && (
            <Li label="Ibu">
              <strong className="font-semibold text-hijau-900">{g.byId.get(mother)?.lat}</strong>
            </Li>
          )}
          {sibs.length > 0 && (
            <Li label="Saudara">
              <NameList names={lat(sibs)} />
            </Li>
          )}
          {uncles.length > 0 && (
            <Li label="Paman & bibi (pihak ayah)">
              <NameList names={lat(uncles)} max={6} />
            </Li>
          )}
          {patrons.length > 0 && (
            <Li label="Tuan (wala')">
              <NameList names={lat(patrons)} />
            </Li>
          )}
          {clients.length > 0 && (
            <Li label="Maula">
              <NameList names={lat(clients)} />
            </Li>
          )}
        </Bullets>
        <Chips>
          {law.spouses.length > 0 && (
            <ActionChip icon="rings" onClick={() => go('nikah', { p: p.id })}>
              Lihat jejaring pernikahan
            </ActionChip>
          )}
          {father && (
            <ActionChip icon="user" onClick={() => openProfile(father, 'bio')}>
              Biografi ayahnya
            </ActionChip>
          )}
        </Chips>
      </Section>
    </div>
  )
}

/** Sources of the profile (dataset + biography citations), folded away at the bottom. */
export function ProfileRefs({ p }: { p: Person }) {
  const bio = useBio()
  const b = bio?.persons[p.id]
  const sources = p.src.map((s) => s.t)
  const extra = [...new Set(Object.values(b ?? {}).flatMap((v) => (v && typeof v === 'object' && 'src' in v ? ((v as Point).src ?? []) : [])))].filter(
    (s) => s !== 'Turath rawi' && !sources.some((x) => x.includes(s)),
  )
  const link = (label: string, url?: string) =>
    url ? (
      <a href={url} target="_blank" rel="noreferrer" className="font-medium text-hijau-700 underline decoration-hijau-600/30 underline-offset-2 hover:decoration-hijau-700">
        {label} <Icon name="external" className="inline h-3 w-3" />
      </a>
    ) : (
      label
    )
  return (
    <Accordion title="Rujukan (Turath & Data Rawi)" count={p.src.length + extra.length}>
      <Bullets>
        {p.src.map((s, i) => (
          <Li key={`s${i}`}>{link(s.t, s.url)}</Li>
        ))}
        {extra.map((s) => (
          <Li key={s}>{link(s, citationUrl(s))}</Li>
        ))}
      </Bullets>
      <ul className="mt-3 list-disc space-y-0.5 border-t border-krem-200 pt-3 pl-4 text-xs text-tinta-soft">
        {b && (
          <li>
            {b.v
              ? 'Uraian naratif diringkas dari kutipan kitab yang ditautkan dan sudah diperiksa ulang terhadap kutipan tersebut.'
              : 'Uraian naratif diringkas otomatis dari kutipan kitab yang ditautkan dan belum diperiksa ulang.'}
          </li>
        )}
        <li>Label "umum" = ringkasan umum yang belum bersitasi halaman kitab.</li>
        <li>Selalu rujuk teks aslinya sebelum mengutip.</li>
      </ul>
    </Accordion>
  )
}
