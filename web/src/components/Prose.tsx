import { useMemo, type ReactNode } from 'react'
import { citationUrl, ROLE_LABEL, toBullets, type Point, type RoleKey, type TribeProfile } from '../lib/bio'
import { useStore } from '../lib/data'
import { Icon } from './Icon'

/* Building blocks shared by the biography and tribe profile: bullet lists with emphasised names,
   Arabic blocks, action chips, notices and accordions. */

const PART = `(?:(?:al|ar|as|ash|asy|at|ath|az|an|ad|adh|adz)-)?`
const TOK = `${PART}['‘’ʿ]?[A-Z][A-Za-z'‘’ʿ-]*`
const NAME = `${TOK}(?:\\s+${TOK})*`
/** "Hasyim bin Abdi Manaf bin Qushay" */
const CHAIN = `${NAME}(?:\\s+(?:bin|binti)\\s+${NAME})+`
/** "Abu Bakar ash-Shiddiq", "Bani Hasyim", "Ummu Salamah" */
const KUNYA = `(?:Abu|Abi|Ummu|Ummi|Ibnu|Ibni|Bani|Banu)\\s+${NAME}`

const TERMS = [
  // places
  'Makkah', 'Madinah', 'Yatsrib', 'Quba', "Tha'if", 'Thaif', 'Syam', 'Najd', 'Hijaz', 'Yaman', 'Tihamah', 'Habasyah', 'Irak',
  'Kufah', 'Bashrah', 'Mesir', 'Damaskus', 'Persia', 'Bahrain', 'Oman', 'Hadhramaut', 'al-Yamamah', 'Yamamah', 'Khaibar', 'Tabuk',
  'Badar', 'Badr', 'Uhud', 'Khandaq', 'Hunain', 'Hudaibiyah', 'Fathu Makkah', "'Aqabah", "Bai'at 'Aqabah", "Bai'atur Ridhwan",
  'Yarmuk', 'Qadisiyah', 'Jamal', 'Shiffin', "Mu'tah", "Bi'r Ma'unah", "ar-Raji'", 'Hirah', 'Dumat al-Jandal', "Ka'bah", "Baqi'",
  "Bu'ats", 'Najran', "Mada'in", 'Nahawand', "Ji'ranah", "Syi'ib Abi Thalib", "Saqifah Bani Sa'idah", 'Siprus', 'Ahwaz', 'Tustar', 'Andalusia',
  // groups & terms
  'Quraisy', 'Anshar', 'Muhajirin', 'Nabi ﷺ', 'Nabi Muhammad ﷺ', 'Rasulullah ﷺ', 'Ahlulbait', 'Ummul Mukminin', 'Ahlu Badar',
  'Khulafaur Rasyidin', 'Riddah', 'Hilf al-Fudhul', 'ilaf', 'siqayah', 'rifadah', 'hijabah', "liwa'", "mu'akhah", 'Dar an-Nadwah',
  "Dar al-Arqam", 'Baitul Mal', 'tahkim', 'naqib',
  // single names that often appear without a nasab
  'Umar', 'Utsman', 'Ali', 'Aisyah', 'Khadijah', 'Fathimah', 'Fatimah', 'Hamzah', "Mu'awiyah", 'Bilal', 'Salman', 'Hafshah', "Ja'far",
  'Usamah', 'Heraklius', 'an-Najasyi', 'Musailimah', 'al-Hasan', 'al-Husain', 'al-Abbas',
]

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function useEmphasisRe(): RegExp {
  const { tribes } = useStore()
  return useMemo(() => {
    const names = [...tribes.values()].flatMap((t) => t.name.replace(/\(.*?\)/g, '').split(/\s*[/&]\s*/)).map((s) => s.trim())
    const terms = [...new Set([...TERMS, ...names])].filter((s) => s.length > 2).sort((a, b) => b.length - a.length).map(esc)
    return new RegExp(`(?<![A-Za-z'‘’ʿ])(?:${CHAIN}|${KUNYA}|${terms.join('|')})(?![A-Za-z])`, 'g')
  }, [tribes])
}

/** Plain text with names, places and key terms in bold for quick scanning. */
export function Rich({ text }: { text: string }) {
  const re = useEmphasisRe()
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <strong key={m.index} className="font-semibold text-hijau-900">
        {m[0]}
      </strong>,
    )
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

/** Small citation note placed at the end of a bullet. */
export function SrcChips({ src, basis }: { src?: string[]; basis?: Point['basis'] }) {
  if (basis === 'umum')
    return (
      <span
        className="ml-1.5 inline-block cursor-help rounded bg-krem-200 px-1.5 align-middle text-[10px] leading-4 font-semibold tracking-wide text-tinta-soft uppercase"
        title="Ringkasan umum, belum bersitasi halaman"
      >
        umum
      </span>
    )
  if (!src?.length) return null
  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-x-1.5 align-middle text-[11px] font-medium text-tinta-soft">
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

/** One themed block: heading with a gold tick, then bullets. */
export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="border-b border-krem-200 py-5 first:pt-1 last:border-0" aria-labelledby={id}>
      <h3 id={id} className="flex items-center gap-2 font-display text-xl font-semibold text-hijau-900">
        <span className="h-5 w-1 rounded-full bg-emas-500" aria-hidden="true" />
        {title}
      </h3>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-tinta">{children}</div>
    </section>
  )
}

/** Small uppercase label above a group of bullets. */
export function SubHead({ children }: { children: ReactNode }) {
  return <h4 className="text-xs font-bold tracking-[0.12em] text-emas-700 uppercase">{children}</h4>
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="space-y-2">{children}</ul>
}

/** A bullet; `label` renders as a bold lead ("Wafat: …"). */
export function Li({ label, children }: { label?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-emas-500" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">
        {label && <span className="font-bold text-emas-700">{label}: </span>}
        {children}
      </div>
    </li>
  )
}

/** A narrative point split into bullets, its citation kept on the last one. */
export function PointItems({ p }: { p?: Point | null }) {
  if (!p?.t) return null
  const items = toBullets(p.t)
  return (
    <>
      {items.map((t, i) => (
        <Li key={i}>
          <Rich text={t} />
          {i === items.length - 1 && <SrcChips src={p.src} basis={p.basis} />}
        </Li>
      ))}
    </>
  )
}

/** Arabic text on its own right-aligned line, large enough for harakat. */
export function ArBlock({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p dir="rtl" lang="ar" className={`ar text-right text-xl leading-[1.9] text-hijau-900 ${className}`}>
      {children}
    </p>
  )
}

/** Inline Arabic inside a Latin line. */
export function ArInline({ children }: { children: ReactNode }) {
  return (
    <span dir="rtl" lang="ar" className="ar text-[1.15em]">
      {children}
    </span>
  )
}

/** Mini action button replacing "… →" text links. */
export function ActionChip({ icon, children, onClick }: { icon?: Parameters<typeof Icon>[0]['name']; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hijau-600/40 bg-hijau-50 px-4 text-sm font-semibold text-hijau-800 transition hover:border-hijau-700 hover:bg-hijau-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hijau-700"
    >
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
      <Icon name="chevron" className="h-4 w-4" />
    </button>
  )
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>
}

/** Info banner with a solid left accent. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="flex gap-3 rounded-r-xl border-l-4 border-emas-600 bg-emas-100 px-4 py-3 text-sm leading-relaxed text-tinta">
      <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-emas-700" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Collapsible block, closed by default. */
export function Accordion({ title, count, icon = 'book', children }: { title: string; count?: number; icon?: Parameters<typeof Icon>[0]['name']; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-krem-300 bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-hijau-900 focus-visible:outline-2 focus-visible:outline-hijau-700 [&::-webkit-details-marker]:hidden">
        <Icon name={icon} className="h-4 w-4 shrink-0 text-emas-700" />
        <span className="flex-1">
          {title}
          {count !== undefined && <span className="ml-1.5 font-medium text-tinta-soft">({count})</span>}
        </span>
        <span className="text-xs font-medium text-hijau-700 group-open:hidden">Buka</span>
        <span className="hidden text-xs font-medium text-hijau-700 group-open:inline">Tutup</span>
        <Icon name="chevron" className="h-4 w-4 shrink-0 text-hijau-700 transition group-open:rotate-90" />
      </summary>
      <div className="border-t border-krem-200 px-4 py-3 text-sm leading-relaxed text-tinta">{children}</div>
    </details>
  )
}

/** Location and the four strategic-role groups of a tribe. */
export function TribeRoles({ t, wilayah }: { t?: TribeProfile; wilayah?: Point | null }) {
  const keys = Object.keys(ROLE_LABEL) as RoleKey[]
  // wilayah bullets that only repeat the short location label are dropped
  const seen = (t?.lokasi ?? '').toLowerCase()
  const extra = wilayah?.t ? toBullets(wilayah.t).filter((x) => !seen.includes(x.toLowerCase())) : []
  return (
    <div className="space-y-4">
      <Bullets>
        <Li label="Lokasi">
          {t?.lokasi ? <Rich text={t.lokasi} /> : <Missing />}
        </Li>
        {extra.map((x, i) => (
          <Li key={i}>
            <Rich text={x} />
            {i === extra.length - 1 && <SrcChips src={wilayah?.src} basis={wilayah?.basis} />}
          </Li>
        ))}
      </Bullets>
      <p className="text-xs text-tinta-soft">Lokasi & peran strategis: ringkasan umum, belum bersitasi halaman kitab.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {keys.map((k) => (
          <div key={k} className="rounded-xl border border-krem-200 bg-krem-50 p-3.5">
            <SubHead>{ROLE_LABEL[k]}</SubHead>
            <div className="mt-2">
              {t?.peran?.[k]?.length ? (
                <Bullets>
                  {t.peran[k]!.map((x, i) => (
                    <Li key={i}>
                      <Rich text={x} />
                    </Li>
                  ))}
                </Bullets>
              ) : (
                <Missing>Belum tercatat dalam ringkasan.</Missing>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Missing({ children = 'Belum tercatat dalam sumber yang dipakai.' }: { children?: ReactNode }) {
  return <span className="text-tinta-soft italic">{children}</span>
}

/** Names as bold inline list: "A, B, dan C". */
export function NameList({ names, max = 8 }: { names: string[]; max?: number }) {
  const l = names.filter(Boolean)
  const shown = l.slice(0, max)
  return (
    <>
      {shown.map((n, i) => (
        <span key={i}>
          {i > 0 && (i === shown.length - 1 && l.length <= max ? (shown.length > 2 ? ', dan ' : ' dan ') : ', ')}
          <strong className="font-semibold text-hijau-900">{n}</strong>
        </span>
      ))}
      {l.length > max && `, serta ${l.length - max} lainnya`}
    </>
  )
}
