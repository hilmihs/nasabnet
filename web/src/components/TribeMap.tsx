import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { citationUrl, useBio, type Place } from '../lib/bio'
import { useStore } from '../lib/data'
import type { Tribe } from '../lib/types'

const GROUP_LABEL: Record<Tribe['group'], string> = { quraisy: 'Quraisy', anshar: 'Anshar', arab: 'Arab lain', ajam: 'Non-Arab' }

type Base = 'relief' | 'satelit' | 'topo' | 'era'
const BASE_LABEL: Record<Base, string> = { relief: 'Relief', satelit: 'Satelit', topo: 'Topografi', era: 'Zaman Nabi ﷺ' }
const CITIES: { id: string; name: string; center: [number, number] }[] = [
  { id: 'makkah', name: 'Makkah', center: [21.4225, 39.8262] },
  { id: 'madinah', name: 'Madinah', center: [24.4672, 39.6111] },
]
/** from this zoom on, an approximate point is drawn as an area instead of a pin */
const AREA_ZOOM = 12

interface Entry {
  tid: string
  p: Place
}
/** one place as the book describes it; the same place can belong to several tribes */
interface Item {
  p: Place
  tids: string[]
}
interface Spot {
  key: string
  lat: number
  lon: number
  approx: boolean
  items: Item[]
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const srcHtml = (src: string[] = []) =>
  src
    .map((x) => {
      const u = citationUrl(x)
      return u ? `<a href="${u}" target="_blank" rel="noreferrer">${esc(x)}</a>` : esc(x)
    })
    .join(' · ')

const placeHtml = (p: Place) => `<div class="nm-head"><strong>${esc(p.t)}</strong> <span class="nm-ar" dir="rtl">${esc(p.ar)}</span></div>
  <div class="nm-meta">${esc(p.kind)}${p.precision === 'perkiraan' ? ` · letak persis tidak disebut kitab; ditaruh di ${esc(p.near ?? '')}` : ''}</div>
  <div>${esc(p.note)}</div>
  <div class="nm-src">ⓘ ${srcHtml(p.src)}</div>`

/** Cited places of every tribe on a map; a point opens what the book says and links to the tribe profile. */
export default function TribeMap({ focus, onSelect }: { focus?: string; onSelect: (tid: string) => void }) {
  const bio = useBio()
  const { g, tribes, tribeColorById } = useStore()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const marks = useRef<L.LayerGroup | null>(null)
  const bases = useRef<Record<Base, L.Layer> | null>(null)
  const [groups, setGroups] = useState<Set<Tribe['group']>>(new Set(['quraisy', 'anshar', 'arab', 'ajam']))
  const [hover, setHover] = useState<string | null>(null)
  const [zoom, setZoom] = useState(5)
  const [base, setBase] = useState<Base>('relief')
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])

  const all = useMemo(() => {
    const out: Entry[] = []
    for (const [tid, t] of Object.entries(bio?.tribes ?? {})) for (const p of t.tempat ?? []) out.push({ tid, p })
    return out
  }, [bio])
  const landmarks = useMemo(() => Object.values(bio?.landmarks ?? {}).flat(), [bio])

  const visible = useMemo(() => all.filter((e) => e.p.lat != null && groups.has(tribes.get(e.tid)?.group ?? 'arab')), [all, groups, tribes])
  const spots = useMemo(() => {
    const m = new Map<string, Spot>()
    for (const e of visible) {
      const approx = e.p.precision === 'perkiraan'
      const key = `${e.p.lat!.toFixed(3)},${e.p.lon!.toFixed(3)},${approx}`
      const s = m.get(key) ?? { key, lat: e.p.lat!, lon: e.p.lon!, approx, items: [] }
      const same = s.items.find((x) => x.p.ar === e.p.ar && x.p.note === e.p.note && x.p.src.join() === e.p.src.join())
      if (same) same.tids.push(e.tid)
      else s.items.push({ p: e.p, tids: [e.tid] })
      m.set(key, s)
    }
    return [...m.values()]
  }, [visible])

  const listed = useMemo(() => {
    const m = new Map<string, { drawn: number; total: number }>()
    for (const e of all) {
      const x = m.get(e.tid) ?? { drawn: 0, total: 0 }
      x.total++
      if (e.p.lat != null) x.drawn++
      m.set(e.tid, x)
    }
    return g.data.tribes.filter((t) => m.has(t.id) && groups.has(t.group)).map((t) => ({ t, ...m.get(t.id)! }))
  }, [all, g, groups])

  // create the map once
  useEffect(() => {
    if (!box.current || map.current) return
    const m = L.map(box.current, { center: [23.5, 43], zoom: 5, minZoom: 3, maxZoom: 19, scrollWheelZoom: false, worldCopyJump: true })
    const esri = (name: string, opts: L.TileLayerOptions = {}) =>
      L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${name}/MapServer/tile/{z}/{y}/{x}`, {
        attribution: 'Tiles &copy; Esri · koordinat: Wikidata &amp; &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        maxNativeZoom: 18, // deepest level Esri serves everywhere; z19 upscales it instead of showing blank tiles
        ...opts,
      })
    bases.current = {
      // World_Physical_Map only exists up to zoom 8: past that, satellite imagery (sharp down to street level)
      relief: L.layerGroup([
        esri('World_Physical_Map', { maxZoom: 8, maxNativeZoom: 8 }),
        esri('World_Imagery', { minZoom: 9 }),
        esri('Reference/World_Boundaries_and_Places', { minZoom: 9, pane: 'overlayPane' }),
      ]),
      satelit: L.layerGroup([esri('World_Imagery'), esri('Reference/World_Boundaries_and_Places', { pane: 'overlayPane' })]),
      topo: esri('World_Topo_Map'),
      // the Prophet's ﷺ time: bare terrain only (no modern roads, buildings or names), tinted
      era: L.layerGroup([
        esri('World_Physical_Map', { maxZoom: 8, maxNativeZoom: 8, className: 'nm-era' }),
        esri('Elevation/World_Hillshade', { minZoom: 9, maxNativeZoom: 16, className: 'nm-era' }),
      ]),
    }
    bases.current.relief.addTo(m)
    m.on('focus', () => m.scrollWheelZoom.enable())
    m.on('blur', () => m.scrollWheelZoom.disable())
    m.on('zoomend', () => setZoom(m.getZoom()))
    layer.current = L.layerGroup().addTo(m)
    marks.current = L.layerGroup()
    map.current = m
    // tribe links inside popups
    const onClick = (ev: MouseEvent) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-tid]')
      if (b?.dataset.tid) select.current(b.dataset.tid)
    }
    box.current.addEventListener('click', onClick)
    const el = box.current
    return () => {
      el.removeEventListener('click', onClick)
      m.remove()
      map.current = null
    }
  }, [])

  // switch the base map; the era view also shows the historical landmarks
  useEffect(() => {
    const m = map.current
    if (!m || !bases.current) return
    for (const [k, l] of Object.entries(bases.current)) {
      if (k === base) l.addTo(m)
      else m.removeLayer(l)
    }
    if (base === 'era') marks.current?.addTo(m)
    else if (marks.current) m.removeLayer(marks.current)
  }, [base])

  // draw tribe places
  const area = zoom >= AREA_ZOOM
  useEffect(() => {
    const lg = layer.current
    if (!lg) return
    lg.clearLayers()
    const hl = hover ?? focus
    for (const s of spots) {
      const tids = [...new Set(s.items.flatMap((x) => x.tids))]
      const on = !hl || tids.includes(hl)
      const color = tids.length === 1 ? tribeColorById(tids[0]) : '#0f3b2e'
      const html = [...s.items]
        .sort((a, b) => Number(b.tids.includes(hl ?? '')) - Number(a.tids.includes(hl ?? '')))
        .map(
          (x) => `<div class="nm-entry">${placeHtml(x.p)}<div class="nm-tribes">${x.tids
            .map((tid) => `<button type="button" data-tid="${tid}" class="nm-tribe" style="border-color:${tribeColorById(tid)}">${esc(tribes.get(tid)?.name ?? tid)} — buka profil</button>`)
            .join('')}</div></div>`,
        )
        .join('')
      const popup = `<div class="nm-pop">${s.approx ? `<p class="nm-approx">${s.items.length} tempat yang letak persisnya tidak disebut kitab — hanya "di/dekat ${esc(s.items[0].p.near ?? '')}".</p>` : ''}${html}</div>`
      if (s.approx && area) {
        // close up, an approximate point is an area, not a pin on whatever building sits at the town's centre
        L.circle([s.lat, s.lon], { radius: 1500, color, weight: 1.5, dashArray: '6 6', fillColor: color, fillOpacity: on ? 0.07 : 0.02, opacity: on ? 0.9 : 0.3 })
          .bindTooltip(`± ${s.items.length} tempat di sekitar ${esc(s.items[0].p.near ?? '')} (letak persis tidak disebut)`, { direction: 'center', className: 'nm-area-label' })
          .bindPopup(popup, { maxWidth: 320, maxHeight: 360 })
          .addTo(lg)
        continue
      }
      const n = s.items.length
      const size = n > 1 ? 22 : 14
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:999px;background:${s.approx ? 'rgba(255,255,255,.85)' : color};border:2px ${s.approx ? 'dashed' : 'solid'} ${s.approx ? color : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.35);color:${s.approx ? '#0f3b2e' : '#fcfaf4'};font:700 10px/1 'Plus Jakarta Sans',sans-serif;opacity:${on ? 1 : 0.25}">${n > 1 ? n : ''}</span>`,
      })
      L.marker([s.lat, s.lon], { icon, zIndexOffset: on ? 1000 : 0, title: s.items.map((x) => x.p.t).join(' / ') })
        .bindPopup(popup, { maxWidth: 320, maxHeight: 360 })
        .addTo(lg)
    }
  }, [spots, focus, hover, tribes, tribeColorById, area])

  // historical landmarks (era view)
  useEffect(() => {
    const lg = marks.current
    if (!lg) return
    lg.clearLayers()
    for (const p of landmarks) {
      if (p.lat == null) continue
      const approx = p.precision === 'perkiraan'
      const icon = L.divIcon({
        className: '',
        iconSize: [14, 14],
        html: `<span class="nm-mark${approx ? ' nm-mark-approx' : ''}"></span>`,
      })
      L.marker([p.lat, p.lon!], { icon, title: p.t })
        .bindTooltip(esc(p.t), { permanent: zoom >= 13, direction: 'right', offset: [8, 0], className: 'nm-mark-label' })
        .bindPopup(`<div class="nm-pop"><div class="nm-entry">${placeHtml(p)}</div></div>`, { maxWidth: 320 })
        .addTo(lg)
    }
  }, [landmarks, zoom])

  // first view: every drawn point
  const fitted = useRef(false)
  useEffect(() => {
    const m = map.current
    if (!m || fitted.current || focus || !visible.length) return
    fitted.current = true
    m.fitBounds(L.latLngBounds(visible.map((e) => L.latLng(e.p.lat!, e.p.lon!))), { padding: [30, 30], maxZoom: 6 })
  }, [visible, focus])

  // zoom to the focused tribe
  useEffect(() => {
    const m = map.current
    if (!m || !focus) return
    const pts = all.filter((e) => e.tid === focus && e.p.lat != null).map((e) => L.latLng(e.p.lat!, e.p.lon!))
    if (pts.length === 1) m.setView(pts[0], 8)
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 9 })
  }, [focus, all])

  const toggle = (k: Tribe['group']) =>
    setGroups((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n.size ? n : s
    })

  const goCity = (c: (typeof CITIES)[number]) => {
    setBase('era')
    const pts = (bio?.landmarks?.[c.id] ?? []).filter((p) => p.lat != null).map((p) => L.latLng(p.lat!, p.lon!))
    if (pts.length > 1) map.current?.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 14 })
    else map.current?.setView(c.center, 13)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-krem-200 px-3 py-2">
          <div className="inline-flex rounded-full border border-krem-300 bg-white p-0.5 text-xs font-semibold" role="group" aria-label="Peta dasar">
            {(Object.keys(BASE_LABEL) as Base[]).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={base === b}
                onClick={() => setBase(b)}
                className={`rounded-full px-3 py-1 ${base === b ? 'bg-hijau-800 text-krem-50' : 'text-hijau-800 hover:bg-krem-100'}`}
              >
                {BASE_LABEL[b]}
              </button>
            ))}
          </div>
          {base === 'era' && (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-tinta-soft">
              Lihat:
              {CITIES.map((c) => (
                <button key={c.id} type="button" onClick={() => goCity(c)} className="rounded-full border border-emas-400 px-2.5 py-0.5 font-semibold text-hijau-800 hover:bg-emas-100">
                  {c.name}
                </button>
              ))}
            </span>
          )}
        </div>
        <div ref={box} className="h-[68vh] min-h-[420px] w-full bg-krem-100" aria-label="Peta wilayah kabilah" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-krem-200 px-4 py-2 text-xs text-tinta-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-white bg-hijau-700 shadow" /> titik tepat (Wikidata/OpenStreetMap)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-dashed border-hijau-700 bg-white" /> perkiraan: kitab hanya menyebut kotanya (dari dekat tampil sebagai area)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-hijau-800 text-[9px] font-bold text-krem-50">2</span> beberapa tempat di satu titik
          </span>
          {base === 'era' && (
            <span className="inline-flex items-center gap-1.5">
              <span className="nm-mark inline-block" /> tempat bersejarah masa Nabi ﷺ (bersitasi)
            </span>
          )}
        </div>
        {base === 'era' && (
          <p className="border-t border-krem-200 bg-emas-100/40 px-4 py-2 text-xs text-tinta-soft">
            Rekonstruksi, bukan peta dari masa itu: dasar peta hanya relief medan (tanpa jalan, bangunan, dan nama modern); titik emas adalah gunung, wadi, sumur,
            dan masjid yang disebut kitab, diletakkan pada koordinat tempat itu sekarang.
          </p>
        )}
      </div>
      <aside className="card flex max-h-[calc(68vh+5rem)] flex-col p-4">
        <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Tempat menurut kitab</p>
        <p className="mt-1 text-xs text-tinta-soft">
          {visible.length} titik dari {all.length} tempat bersitasi. Klik titik untuk kutipan kitabnya; tempat tanpa koordinat pasti tetap tercantum di profil kabilah.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(GROUP_LABEL) as Tribe['group'][]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${groups.has(k) ? 'border-hijau-800 bg-hijau-800 text-krem-50' : 'border-krem-300 text-hijau-800'}`}
            >
              {GROUP_LABEL[k]}
            </button>
          ))}
        </div>
        <ul className="mt-3 -mr-2 flex-1 space-y-0.5 overflow-y-auto pr-2">
          {listed
            .sort((a, b) => b.drawn - a.drawn || a.t.name.localeCompare(b.t.name))
            .map(({ t, drawn, total }) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  onMouseEnter={() => setHover(t.id)}
                  onMouseLeave={() => setHover(null)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-krem-100 ${focus === t.id ? 'bg-krem-200 font-semibold' : ''}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tribeColorById(t.id) }} />
                  <span className="min-w-0 flex-1 truncate text-hijau-900">{t.name}</span>
                  <span className="text-xs text-tinta-soft">
                    {drawn}
                    {total > drawn ? `/${total}` : ''}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </aside>
    </div>
  )
}
