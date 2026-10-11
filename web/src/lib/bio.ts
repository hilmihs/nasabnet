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
  v?: boolean
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

/** Turath link for a citation tag such as "al-Ishabah 4/484" or "Ibnu Sa'd 3/265". */
const MULTI_VOL: [RegExp, number][] = [
  [/Ishabah/i, 9767],
  [/Usdul Ghabah/i, 1110],
  [/Sirah Ibnu Hisyam/i, 23833],
  [/Thabari/i, 9783],
  [/Sa'?d/i, 9351],
]
const ONE_VOL: [RegExp, number][] = [
  [/Jamharat Ansab/i, 9793],
  [/Nasab Quraisy/i, 2922],
  [/Muhabbar/i, 12205],
]

export function citationUrl(tag: string): string | undefined {
  const m = tag.match(/(\d+)\/(\d+)/)
  const multi = m && MULTI_VOL.find(([re]) => re.test(tag))
  if (multi) return `https://app.turath.io/book/${multi[1]}?print_page=${m[1]},${m[2]}`
  const one = ONE_VOL.find(([re]) => re.test(tag))
  const p = tag.match(/(\d+)\s*$/)
  if (one && p) return `https://app.turath.io/book/${one[1]}?print_page=1,${p[1]}`
  return undefined
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
