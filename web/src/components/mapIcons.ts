/** Small pictograms for the "Zaman Nabi" map: one per kind of place, drawn in a round medallion. */
const P: Record<string, string> = {
  kota: '<path d="M3 13V7h2V5h2v2h2V5h2v2h2v6z" /><path d="M7 13v-3h2v3" fill="#fcfaf4"/>',
  desa: '<path d="M2.5 8 8 3.5 13.5 8H12v5H4V8z" /><rect x="7" y="9.5" width="2" height="3.5" fill="#fcfaf4"/>',
  rumah: '<path d="M2.5 8 8 3.5 13.5 8H12v5H4V8z" /><rect x="7" y="9.5" width="2" height="3.5" fill="#fcfaf4"/>',
  lembah: '<path d="M2 6c2-2 4 2 6 0s4 2 6 0M2 10c2-2 4 2 6 0s4 2 6 0" fill="none" stroke-width="1.6"/>',
  wadi: '<path d="M2 6c2-2 4 2 6 0s4 2 6 0M2 10c2-2 4 2 6 0s4 2 6 0" fill="none" stroke-width="1.6"/>',
  gunung: '<path d="M1.5 13 6 5l2.5 4L10 7l4.5 6z" />',
  'mata air': '<path d="M8 2.5C6 6 4.5 7.8 4.5 9.8a3.5 3.5 0 0 0 7 0C11.5 7.8 10 6 8 2.5z" />',
  sumur: '<path d="M3 6h10M4 6v6h8V6M6 6V3.5h4V6" fill="none" stroke-width="1.5"/><path d="M4.5 9h7v3h-7z" />',
  masjid: '<path d="M4 13V9a4 4 0 0 1 8 0v4z" /><path d="M8 2.2v2.6M13.2 13V6.5" fill="none" stroke-width="1.3"/>',
  harrah: '<circle cx="4.5" cy="9" r="2"/><circle cx="9.5" cy="6.5" r="2.4"/><circle cx="11" cy="11" r="1.8"/><circle cx="6.5" cy="12.3" r="1.3"/>',
  daerah: '<path d="M4 14V2.5M4 3h8l-2 2.5 2 2.5H4" fill="none" stroke-width="1.5"/>',
  distrik: '<path d="M3 3h10v10H3z" fill="none" stroke-width="1.5"/><path d="M3 8h10M8 3v10" fill="none" stroke-width="1"/>',
  benteng: '<path d="M3.5 14V6h1V3h2v2h1V3h2v2h1V3h2v3h1v8z" />',
  pasar: '<path d="M2 6l2-4h8l2 4zM3 7h10v6H3z" />',
  pasir: '<path d="M1.5 12c2-3 4-3 6 0M7.5 12c2-4 5-4 7 0" fill="none" stroke-width="1.5"/><circle cx="4" cy="6" r=".8"/><circle cx="8" cy="4.5" r=".8"/><circle cx="12" cy="6.5" r=".8"/>',
  kebun: '<path d="M8 14V8" stroke-width="1.6" fill="none"/><path d="M8 8C6 4.5 3.5 4.5 2 6c2-.2 4 .5 6 2zm0 0c2-3.5 4.5-3.5 6-2-2-.2-4 .5-6 2zm0 0C7.4 4.5 5.5 2.4 3.6 2.4 5.6 3 7 5 8 8zm0 0c.6-3.5 2.5-5.6 4.4-5.6C10.4 3 9 5 8 8z"/>',
  laut: '<path d="M1.5 7c2-2 3.5 2 6.5 0s4.5 2 6.5 0M1.5 11c2-2 3.5 2 6.5 0s4.5 2 6.5 0" fill="none" stroke-width="1.5"/>',
  wilayah: '<path d="M4 14V2.5M4 3h8l-2 2.5 2 2.5H4" fill="none" stroke-width="1.5"/>',
  parit: '<path d="M1.5 9h3M6.5 9h3M11.5 9h3" fill="none" stroke-width="2.2"/><path d="M2 12h12" fill="none" stroke-width=".8"/>',
  jalur: '<path d="M3 12c0-2 1-2.5 2-3l1-3c.5-1 1.5-1 2 0l.5 1.5c1 .3 2 0 3 .5.8.5 1 2 .5 3.5H11v1.5H9.5V12H6v1.5H4.5z"/>',
}

/** Inner SVG for a kind (falls back to a dot). */
const ALIAS: Record<string, string> = { uthum: 'benteng', istana: 'benteng', kawasan: 'distrik' }

export function pictogram(kind: string, color: string): string {
  const body = P[ALIAS[kind] ?? kind] ?? '<circle cx="8" cy="8" r="3"/>'
  return `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="${color}" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="0">${body}</svg>`
}

/** Round medallion with a pictogram; dashed ring = approximate position. */
export function medallion(kind: string, ring: string, opts: { approx?: boolean; on?: boolean; gold?: boolean } = {}): string {
  const { approx = false, on = true, gold = false } = opts
  const bg = gold ? '#f6ecc8' : '#fcfaf4'
  return `<span class="nm-medal" style="border:2px ${approx ? 'dashed' : 'solid'} ${ring};background:${bg};opacity:${on ? 1 : 0.3}">${pictogram(kind, gold ? '#6b4a12' : '#3b3026')}</span>`
}

/** SVG <defs> patterns shared by the era layer (mountain hatching, sand, lava). */
export const PATTERNS = `<defs>
<pattern id="nm-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="6" fill="#d8c3a0" fill-opacity="0.55"/><line x1="0" y1="0" x2="0" y2="6" stroke="#7a5c3a" stroke-width="1.2" stroke-opacity="0.55"/></pattern>
<pattern id="nm-sand" width="22" height="16" patternUnits="userSpaceOnUse"><rect width="22" height="16" fill="#ecd7a4" fill-opacity="0.55"/><path d="M1 12c3-4 6-4 9 0M12 6c3-4 6-4 9 0" fill="none" stroke="#b8925a" stroke-width="1" stroke-opacity="0.7"/><circle cx="6" cy="4" r=".7" fill="#a07d48"/><circle cx="17" cy="12" r=".7" fill="#a07d48"/><circle cx="12" cy="14" r=".5" fill="#a07d48"/></pattern>
<pattern id="nm-lava" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#5b4a42" fill-opacity="0.32"/><circle cx="2" cy="2" r="1.1" fill="#2f2622" fill-opacity="0.65"/><circle cx="6.5" cy="5.5" r="1.4" fill="#2f2622" fill-opacity="0.6"/><circle cx="3" cy="7.5" r=".8" fill="#2f2622" fill-opacity="0.6"/></pattern>
</defs>`
