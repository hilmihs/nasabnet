import { useEffect, useState } from 'react'

/** One narrative point with the excerpts it was taken from. */
export interface Point {
  t: string
  src?: string[]
  /** tribe profiles: "sumber" = from a cited excerpt, "umum" = general summary without page citation */
  basis?: 'sumber' | 'umum'
}

export interface PersonBio {
  identitas?: { lahir?: string | null; umur?: string | null; wafat?: string | null; makam?: string | null; src?: string[] } | null
  kabilah_tabaqat?: Point | null
  nisbah_rihlah?: Point | null
  laqab_profesi?: Point | null
  peran?: Point | null
  hilf?: Point | null
  syaraf?: Point | null
  catatan?: string | Point | null
  /** true when fact-checked against the excerpts */
  v?: boolean
}

export interface TribeProfile {
  nama_arti?: Point | null
  leluhur?: Point | null
  titik_temu?: Point | null
  struktur?: Point | null
  wilayah?: Point | null
  peran_sosial?: Point | null
  hilf?: Point | null
  tokoh?: string[]
  dinamika?: Point | null
  rujukan?: string[]
  /** short place label, e.g. "Yatsrib/Madinah" (data/tribe_roles.json) */
  lokasi?: Point
  /** strategic roles as bullets, each cited to a book page or marked basis "umum" */
  peran?: Partial<Record<RoleKey, Point[]>>
  /** cited places for the tribe map (data/tribe_places.json) */
  tempat?: Place[]
  v?: boolean
}

/** A place a book ties to a tribe; lat/lon from Wikidata ("perkiraan" = coordinates of the nearby locality it names). */
export interface Place {
  t: string
  ar: string
  kind: string
  note: string
  src: string[]
  lat?: number
  lon?: number
  precision?: 'tepat' | 'perkiraan'
  near?: string
}

export type RoleKey = 'militer' | 'diplomasi' | 'ekonomi' | 'sosial'

export const ROLE_LABEL: Record<RoleKey, string> = {
  militer: 'Kemiliteran & Pertahanan',
  diplomasi: 'Diplomasi & Negosiasi Politik',
  ekonomi: 'Logistik, Perdagangan & Ekonomi',
  sosial: 'Sosial, Budaya & Keagamaan',
}

export interface BioData {
  persons: Record<string, PersonBio>
  tribes: Record<string, TribeProfile>
  /** historical landmarks of Makkah/Madinah for the map's "Zaman Nabi" view (data/landmarks.json) */
  landmarks?: Record<string, Place[]>
  /** wadis, mountains, harrah and gardens drawn on the "Zaman Nabi" map (data/shapes.json) */
  shapes?: Record<string, Shape[]>
}

/** A cited natural feature: OSM geometry as lines ([lat, lon] points) or, for a name-only label, a point. */
export interface Shape {
  t: string
  ar: string
  kind: 'wadi' | 'gunung' | 'harrah' | 'kebun'
  note: string
  src: string[]
  lines?: [number, number][][]
  lat?: number
  lon?: number
}

let cache: Promise<BioData> | null = null

/** bio.json is loaded on first use so the home page only pays for the graph data. */
export function loadBio(): Promise<BioData> {
  if (!cache)
    cache = fetch(`${import.meta.env.BASE_URL}data/bio.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BioData>) : { persons: {}, tribes: {} }))
      .catch(() => ({ persons: {}, tribes: {} }))
  return cache
}

export function useBio(): BioData | null {
  const [data, setData] = useState<BioData | null>(null)
  useEffect(() => {
    let alive = true
    loadBio().then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [])
  return data
}

/** Turath link for a citation tag such as "al-Ishabah 4/484" or "Jamharat Ansab al-'Arab, hlm. 150"
 * (tag prefixes as in scripts/books.py). */
const BOOK_TAGS: [string, number][] = [
  ['al-Ishabah ', 9767],
  ["Ibnu Sa'd ", 9351],
  ['Usdul Ghabah ', 1110],
  ['Sirah Ibnu Hisyam ', 23833],
  ['Tarikh ath-Thabari ', 9783],
  ["Jamharat Ansab al-'Arab", 9793],
  ['Nasab Quraisy', 2922],
  ['al-Muhabbar', 12205],
  ['Jamharat an-Nasab Ibnul Kalbi', 919],
  ['Ansab al-Asyraf ', 9773],
  ['al-Isytiqaq', 9211],
  ['Nihayat al-Arab al-Qalqasyandi', 31382],
  ["al-Inbah 'ala Qaba'il ar-Ruwat", 6696],
  ["al-Ansab as-Sam'ani ", 12317],
  ['al-Munammaq', 12212],
  ["al-Isti'ab ", 12288],
  ["Mu'jam al-Buldan ", 23735],
  ["Mu'jam ma Ista'jam ", 11802],
  ["Shifat Jazirat al-'Arab", 12521],
  ['Futuh al-Buldan', 12221],
  ['ar-Raudh al-Unuf ', 1514],
  ["al-'Iqd al-Farid ", 23789],
  ['al-Kamil fi at-Tarikh ', 21712],
  ['al-Bidayah wan-Nihayah ', 4445],
  ['Shahih al-Bukhari ', 1681],
  ['Shahih Muslim ', 1727],
]

export function citationUrl(tag: string): string | undefined {
  const book = BOOK_TAGS.find(([prefix]) => tag.startsWith(prefix))
  if (!book) return undefined
  const multi = tag.match(/(\d+)\/(\d+)\s*$/)
  if (multi) return `https://app.turath.io/book/${book[1]}?print_page=${multi[1]},${multi[2]}`
  const one = tag.match(/hlm\.\s*(\d+)\s*$/)
  return one ? `https://app.turath.io/book/${book[1]}?print_page=1,${one[1]}` : undefined
}

const NO_SPLIT = /\b(?:hlm|w|no|dkk|dll|dsb|cet|jil|saw|ra)\.$/i
const PARTICLE = /^(?:al|ar|as|ash|asy|at|ath|az|an|ad|adh|adz)-/

/** Break narrative text into short bullet items: at top-level "; " and sentence ends, never inside parentheses. */
export function toBullets(text: string): string[] {
  const out: string[] = []
  const push = (s: string) => {
    const x = s.trim().replace(/[.;,]+$/, '').trim()
    if (x) out.push(PARTICLE.test(x) ? x : x.charAt(0).toUpperCase() + x.slice(1))
  }
  let depth = 0
  let cur = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(' || c === '[') depth++
    else if ((c === ')' || c === ']') && depth > 0) depth--
    cur += c
    if (depth > 0) continue
    const rest = text.slice(i + 1)
    if ((c === ';' && /^\s/.test(rest)) || (c === '.' && /^\s+["“'‘ʿ(]?[A-Z]/.test(rest) && !NO_SPLIT.test(cur))) {
      push(cur)
      cur = ''
    }
  }
  push(cur)
  return out
}
