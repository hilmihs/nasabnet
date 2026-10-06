export type Gender = 'm' | 'f'

export type Category =
  | 'muhajirin'
  | 'anshar'
  | 'ahlulbait'
  | 'kerabat'
  | 'ummahat'
  | 'asyarah'
  | 'badar'
  | 'khulafa'

export type EdgeKind = 'parent' | 'spouse' | 'sibling' | 'muakhah' | 'mawla' | 'milk'

export interface Source {
  /** label shown to the user, e.g. "Turath · Rawi #4500" or "al-Ishabah 4/464" */
  t: string
  url?: string
}

export interface LineageLink {
  ar: string
  /** person id when this ancestor exists as a node */
  id?: string
}

export interface Person {
  id: string
  ar: string
  lat: string
  full?: string
  kunya?: string
  laqab?: string
  g: Gender
  tribe?: string
  clan?: string
  cats: Category[]
  death?: string
  rank?: string
  /** true when a companion (sahabi/sahabiyyah) */
  comp: boolean
  nisba?: string
  place?: string
  /** raw relation text from Turath (علاقات الراوي) */
  rel?: string
  note?: string
  /** patrilineal chain from the person upward: [father, grandfather, ...] */
  line: LineageLink[]
  src: Source[]
}

export interface Edge {
  s: string
  t: string
  /** parent: s is parent of t. others are symmetric */
  k: EdgeKind
  n?: string
  src?: Source
}

export interface Tribe {
  id: string
  ar: string
  name: string
  group: 'quraisy' | 'anshar' | 'arab' | 'ajam'
  desc: string
  /** for Quraysh clans: ancestor chain to the clan meeting point */
  ancestor?: string
}

export interface Dataset {
  meta: { generated: string; source: string; counts: Record<string, number> }
  tribes: Tribe[]
  persons: Person[]
  edges: Edge[]
}

export const CATEGORY_LABEL: Record<Category, string> = {
  muhajirin: 'Muhajirin',
  anshar: 'Anshar',
  ahlulbait: 'Ahlulbait',
  kerabat: 'Kerabat Nabi',
  ummahat: 'Ummahatul Mukminin',
  asyarah: "Al-'Asyarah",
  badar: 'Ahlu Badar',
  khulafa: 'Khulafaur Rasyidin',
}

export const EDGE_LABEL: Record<EdgeKind, string> = {
  parent: 'orang tua',
  spouse: 'pernikahan',
  sibling: 'saudara',
  muakhah: "mu'akhah",
  mawla: "wala' (maula)",
  milk: 'saudara sepersusuan',
}
