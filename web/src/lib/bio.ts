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
  v?: boolean
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
export function citationUrl(tag: string): string | undefined {
  const m = tag.match(/(\d+)\/(\d+)/)
  if (/Ishabah/i.test(tag) && m) return `https://app.turath.io/book/9767?print_page=${m[1]},${m[2]}`
  if (/Sa'?d/i.test(tag) && m) return `https://app.turath.io/book/9351?print_page=${m[1]},${m[2]}`
  const j = tag.match(/Jamharat Ansab.*?(\d+)/)
  if (j) return `https://app.turath.io/book/9793?print_page=1,${j[1]}`
  return undefined
}
