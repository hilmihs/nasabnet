import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { citationUrl, useBio, type Place, type Shape } from '../lib/bio'
import { useStore } from '../lib/data'
import { medallion, PATTERNS } from './mapIcons'
import { SrcChips } from './Prose'
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
const AREA_M = 1500
/** from this zoom on, places sharing one point are fanned out around it */
const SPIDER_ZOOM = 13
/** landmark names are written on the map from this zoom (only where they do not overlap) */
const LABEL_ZOOM = 13
const ERA_MAX_ZOOM = 16
/** era view: pictogram medallions from this zoom (dots below, else the peninsula drowns in icons) */
const MEDAL_ZOOM = 7
/** era view: Makkah/Madinah landmarks and city features from this zoom */
const LOCAL_ZOOM = 10

const KIND_LABEL: Record<Shape['kind'], string> = {
  wadi: 'wadi',
  gunung: 'gunung',
  harrah: 'harrah (padang batu lava)',
  kebun: 'kebun kurma',
  kawasan: 'kawasan kabilah',
  benteng: 'benteng (uthum)',
  pasar: 'pasar',
  parit: 'parit (Khandaq)',
  pasir: 'padang pasir',
  wilayah: 'wilayah',
  laut: 'laut',
  jalur: 'jalur kafilah',
}
const TOWER =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 15V6h1V3h2v2h1V3h2v2h1V3h2v3h1v9z" fill="#6b4a2b" stroke="#fcfaf4" stroke-width=".8"/></svg>'
const STALL =
  '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 6l2-4h8l2 4zM3 7h10v7H3z" fill="#8a6a12" stroke="#fcfaf4" stroke-width=".8"/></svg>'
const PALM =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 22V11" stroke="#6b4a2b" stroke-width="2" stroke-linecap="round"/><path d="M12 11C9 6 5 6 3 8c3-.5 6 .5 9 3zm0 0c3-5 7-5 9-3-3-.5-6 .5-9 3zm0 0C11 6 8 3 5 3c3 1 5 4 7 8zm0 0c1-5 4-8 7-8-3 1-5 4-7 8z" fill="#4f6b3a"/></svg>'

/** n points on a ring of `px` pixels around `c` at the map's current zoom */
function fan(m: L.Map, c: L.LatLng, n: number, px: number, start = -Math.PI / 2): L.LatLng[] {
  const o = m.latLngToLayerPoint(c)
  const r = Math.max(px, (n * 18) / (2 * Math.PI))
  return Array.from({ length: n }, (_, i) => {
    const a = start + (2 * Math.PI * i) / n
    return m.layerPointToLatLng(L.point(o.x + r * Math.cos(a), o.y + r * Math.sin(a)))
  })
}

interface LegendEntry {
  kind: string
  t: string
  ar?: string
  note: string
  src: string[]
}
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
  const nature = useRef<L.LayerGroup | null>(null)
  const unplaced = useRef<L.LayerGroup | null>(null)
  /** label boxes already used on the map (layer pixels), so later labels avoid them */
  const labelBoxes = useRef<L.Bounds[]>([])
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
  const shapes = useMemo(
    () => Object.entries(bio?.shapes ?? {}).flatMap(([k, v]) => (k.startsWith('_') ? [] : (v as Shape[]).map((f) => ({ ...f, area: k })))),
    [bio],
  )
  /** cited definitions of the map's terms (shapes_out/<area>.json "legend") */
  const legend = useMemo(
    () => Object.entries(bio?.shapes ?? {}).flatMap(([k, v]) => (k.startsWith('_legend') ? (v as unknown as LegendEntry[]) : [])),
    [bio],
  )

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
        esri('Elevation/World_Hillshade', { minZoom: 9, maxZoom: 13, maxNativeZoom: 13, className: 'nm-era' }),
        // close up the city plan matters more than the terrain: relief fades to a hint over the parchment
        esri('Elevation/World_Hillshade', { minZoom: 14, maxNativeZoom: ERA_MAX_ZOOM, className: 'nm-era', opacity: 0.3 }),
      ]),
    }
    bases.current.relief.addTo(m)
    m.on('focus', () => m.scrollWheelZoom.enable())
    m.on('blur', () => m.scrollWheelZoom.disable())
    m.on('zoomend', () => setZoom(m.getZoom()))
    unplaced.current = L.layerGroup().addTo(m)
    layer.current = L.layerGroup().addTo(m)
    marks.current = L.layerGroup()
    // natural features sit under every marker
    m.createPane('nature').style.zIndex = '350'
    nature.current = L.layerGroup()
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
    for (const l of [nature.current, marks.current]) {
      if (!l) continue
      if (base === 'era') l.addTo(m)
      else m.removeLayer(l)
    }
    // the terrain model behind the era view has no detail past zoom 16 — deeper would only blur it
    m.setMaxZoom(base === 'era' ? ERA_MAX_ZOOM : 19)
    // classList, not React's className: Leaflet keeps its own classes on this element
    m.getContainer().classList.toggle('nm-parchment', base === 'era')
  }, [base])

  // draw tribe places
  const area = zoom >= AREA_ZOOM
  useEffect(() => {
    const lg = layer.current
    const m = map.current
    if (!lg || !m) return
    lg.clearLayers()
    const hl = hover ?? focus
    const tribeButtons = (tids: string[]) =>
      `<div class="nm-tribes">${tids
        .map((tid) => `<button type="button" data-tid="${tid}" class="nm-tribe" style="border-color:${tribeColorById(tid)}">${esc(tribes.get(tid)?.name ?? tid)} — buka profil</button>`)
        .join('')}</div>`
    const itemHtml = (x: Item) => `<div class="nm-entry">${placeHtml(x.p)}${tribeButtons(x.tids)}</div>`
    const dot = (color: string, size: number, approx: boolean, on: boolean, label = '') =>
      L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:999px;background:${approx ? 'rgba(255,255,255,.85)' : color};border:2px ${approx ? 'dashed' : 'solid'} ${approx ? color : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.35);color:${approx ? '#0f3b2e' : '#fcfaf4'};font:700 10px/1 'Plus Jakarta Sans',sans-serif;opacity:${on ? 1 : 0.25}">${label}</span>`,
      })
    // area badges only where they fit, the biggest areas first
    const badgeBoxes: L.Bounds[] = []
    const badgeFits = new Set<string>()
    if (area)
      for (const s of [...spots].filter((x) => x.approx).sort((a, b) => b.items.length - a.items.length)) {
        const pt = m.latLngToLayerPoint([s.lat + AREA_M / 111320, s.lon])
        const w = 60 + (s.items[0].p.near ?? '').length * 6
        const box = L.bounds([pt.x - w / 2, pt.y - 10], [pt.x + w / 2, pt.y + 10])
        if (badgeBoxes.some((b) => b.intersects(box))) continue
        badgeBoxes.push(box)
        badgeFits.add(s.key)
      }
    for (const s of spots) {
      const tids = [...new Set(s.items.flatMap((x) => x.tids))]
      const on = !hl || tids.includes(hl)
      const color = tids.length === 1 ? tribeColorById(tids[0]) : '#0f3b2e'
      const items = [...s.items].sort((a, b) => Number(b.tids.includes(hl ?? '')) - Number(a.tids.includes(hl ?? '')))
      const near = esc(s.items[0].p.near ?? '')
      const popup = `<div class="nm-pop">${s.approx ? `<p class="nm-approx">${s.items.length} tempat yang letak persisnya tidak disebut kitab — hanya "di/dekat ${near}".</p>` : ''}${items.map(itemHtml).join('')}</div>`
      const opts = { maxWidth: 320, maxHeight: 360 }
      if (s.approx && area) {
        // close up, an approximate point is an area, not a pin on whatever building sits at the town's centre;
        // its label is a badge on the rim so it never covers what lies inside
        L.circle([s.lat, s.lon], { radius: AREA_M, color, weight: base === 'era' ? 1 : 1.5, dashArray: '6 6', fillColor: color, fillOpacity: base === 'era' ? 0.015 : on ? 0.06 : 0.02, opacity: base === 'era' ? 0.35 : on ? 0.9 : 0.3 })
          .bindPopup(popup, opts)
          .addTo(lg)
        if (badgeFits.has(s.key) && base !== 'era')
          L.marker([s.lat + AREA_M / 111320, s.lon], {
            icon: L.divIcon({ className: '', iconSize: undefined, html: `<span class="nm-area-badge" style="border-color:${color}">± ${s.items.length} tempat · sekitar ${near}</span>` }),
            zIndexOffset: 500,
          })
            .bindPopup(popup, opts)
            .addTo(lg)
        continue
      }
      if (s.items.length > 1 && zoom >= SPIDER_ZOOM) {
        // several places on one point: fan them out around it, each with its own card
        const pts = fan(m, L.latLng(s.lat, s.lon), s.items.length, 26)
        L.marker([s.lat, s.lon], { icon: dot('#0f3b2e', 8, false, on), interactive: false }).addTo(lg)
        items.forEach((x, i) => {
          const c = x.tids.length === 1 ? tribeColorById(x.tids[0]) : '#0f3b2e'
          L.polyline([[s.lat, s.lon], pts[i]], { color: '#0f3b2e', weight: 1, opacity: 0.5, interactive: false }).addTo(lg)
          const xon = !hl || x.tids.includes(hl)
          const icon = base === 'era' && zoom >= MEDAL_ZOOM ? L.divIcon({ className: '', iconSize: [20, 20], html: medallion(x.p.kind, c, { approx: s.approx, on: xon }) }) : dot(c, 14, s.approx, xon)
          L.marker(pts[i], { icon, title: x.p.t, zIndexOffset: 1000 })
            .bindPopup(`<div class="nm-pop">${itemHtml(x)}</div>`, opts)
            .addTo(lg)
        })
        continue
      }
      const n = s.items.length
      const icon =
        base === 'era' && n === 1 && zoom >= MEDAL_ZOOM
          ? L.divIcon({ className: '', iconSize: [20, 20], html: medallion(s.items[0].p.kind, color, { approx: s.approx, on }) })
          : dot(color, n > 1 ? 22 : 14, s.approx, on, n > 1 ? String(n) : '')
      L.marker([s.lat, s.lon], { icon, zIndexOffset: on ? 1000 : 0, title: s.items.map((x) => x.p.t).join(' / ') })
        .bindPopup(popup, opts)
        .addTo(lg)
    }
  }, [spots, focus, hover, tribes, tribeColorById, area, zoom, base])

  // places without a point: region zones ("somewhere in Najd") and one "?" card per tribe with the rest
  useEffect(() => {
    const lg = unplaced.current
    const m = map.current
    if (!lg || !m) return
    lg.clearLayers()
    const shown = (tid: string) => groups.has(tribes.get(tid)?.group ?? 'arab')
    const button = (tid: string) =>
      `<button type="button" data-tid="${tid}" class="nm-tribe" style="border-color:${tribeColorById(tid)}">${esc(tribes.get(tid)?.name ?? tid)} — buka profil</button>`
    const card = (p: Place, tids: string[]) =>
      `<div class="nm-entry"><div class="nm-head"><strong>${esc(p.t)}</strong> <span class="nm-ar" dir="rtl">${esc(p.ar)}</span></div><div class="nm-meta">${esc(p.kind)}</div><div>${esc(p.note)}</div><div class="nm-src">ⓘ ${srcHtml(p.src)}</div><div class="nm-tribes">${tids.map(button).join('')}</div></div>`
    // zones
    const zones = new Map<string, { lat: number; lon: number; km: number; name: string; rows: Entry[] }>()
    for (const e of all) {
      if (e.p.lat != null || e.p.zone_lat == null || !shown(e.tid)) continue
      const k = `${e.p.zone_lat},${e.p.zone_lon}`
      const z = zones.get(k) ?? { lat: e.p.zone_lat, lon: e.p.zone_lon!, km: e.p.zone_km ?? 120, name: e.p.zone ?? '', rows: [] }
      z.rows.push(e)
      zones.set(k, z)
    }
    const zoneBoxes: L.Bounds[] = []
    for (const z of [...zones.values()].sort((a, b) => b.rows.length - a.rows.length)) {
      const pt = m.latLngToLayerPoint([z.lat, z.lon])
      const w = (34 + z.name.length) * 6.4 + 16
      const box = L.bounds([pt.x - w / 2, pt.y - 11], [pt.x + w / 2, pt.y + 11])
      const badge = !zoneBoxes.some((b) => b.intersects(box))
      if (badge) zoneBoxes.push(box)
      const pop = `<div class="nm-pop"><p class="nm-approx">${z.rows.length} tempat yang menurut kitab ada "di suatu tempat di ${esc(z.name)}" — letak persisnya tidak disebut.</p>${z.rows.map((e) => card(e.p, [e.tid])).join('')}</div>`
      L.circle([z.lat, z.lon], { radius: z.km * 1000, color: '#7a5c3a', weight: 1, dashArray: '2 8', fillColor: '#c9a86a', fillOpacity: 0.06, opacity: 0.5 })
        .bindPopup(pop, { maxWidth: 320, maxHeight: 360 })
        .addTo(lg)
      if (badge)
        L.marker([z.lat, z.lon], { icon: L.divIcon({ className: '', iconSize: undefined, html: `<span class="nm-zone-badge">± ${z.rows.length} tempat · di suatu tempat di ${esc(z.name)}</span>` }), zIndexOffset: 200 })
          .bindPopup(pop, { maxWidth: 320, maxHeight: 360 })
          .addTo(lg)
    }
    // per-tribe "?" cards at the middle of the tribe's known points
    const byTribe = new Map<string, Place[]>()
    for (const e of all) if (e.p.lat == null && e.p.zone_lat == null && shown(e.tid)) byTribe.set(e.tid, [...(byTribe.get(e.tid) ?? []), e.p])
    for (const [tid, ps] of byTribe) {
      const pts = all.filter((e) => e.tid === tid && e.p.lat != null)
      if (!pts.length) continue
      const lat = pts.reduce((a, e) => a + e.p.lat!, 0) / pts.length
      const lon = pts.reduce((a, e) => a + e.p.lon!, 0) / pts.length
      const pop = `<div class="nm-pop"><p class="nm-approx">${ps.length} tempat milik ${esc(tribes.get(tid)?.name ?? tid)} yang letaknya belum diketahui. Kartu ini sengaja ditaruh di tengah sebaran tempat kabilah ini yang sudah bertitik — bukan lokasi tempat-tempat ini.</p>${ps.map((p) => card(p, [tid])).join('')}</div>`
      L.marker([lat, lon], {
        icon: L.divIcon({ className: '', iconSize: [20, 20], html: medallion('tanya', tribeColorById(tid), { approx: true, on: !focus || focus === tid }) }),
        title: `${ps.length} tempat lain (letak belum diketahui)`,
        zIndexOffset: 300,
      })
        .bindPopup(pop, { maxWidth: 320, maxHeight: 360 })
        .addTo(lg)
    }
  }, [all, groups, tribes, tribeColorById, focus, zoom])

  // natural features (era view): drawn like an old map — wadis as sandy courses, mountains hatched, harrah as names
  useEffect(() => {
    const lg = nature.current
    const m = map.current
    if (!lg || !m) return
    lg.clearLayers()
    const placed: L.Bounds[] = []
    labelBoxes.current = placed
    const fits = (at: L.LatLngExpression, text: string, size: number) => {
      const pt = m.latLngToLayerPoint(at)
      const w = text.length * size * 0.62 + 10
      const box = L.bounds([pt.x - w / 2, pt.y - size], [pt.x + w / 2, pt.y + size])
      if (placed.some((b) => b.intersects(box))) return false
      placed.push(box)
      return true
    }
    const popup = (f: Shape) => `<div class="nm-pop"><div class="nm-entry">${placeHtml({ ...f, kind: KIND_LABEL[f.kind] } as Place)}</div></div>`
    for (const f of shapes) {
      // city features (Makkah/Madinah) only close up; the peninsula layer at every zoom
      if (f.area !== 'arabia' && zoom < LOCAL_ZOOM) continue
      if (f.lines?.length) {
        if (f.kind === 'jalur') {
          L.polyline(f.lines, { pane: 'nature', color: '#6b3f2a', weight: 2.5, opacity: 0.8, dashArray: '2 7', lineCap: 'round' }).bindPopup(popup(f)).addTo(lg)
          const line = f.lines[0]
          const mid = line[Math.floor(line.length / 2)]
          if (fits(mid, f.t, 11))
            L.marker(mid, { pane: 'nature', icon: L.divIcon({ className: '', iconSize: undefined, html: `<span class="nm-route-label">${medallion('jalur', '#6b3f2a')}${esc(f.t)}</span>` }) })
              .bindPopup(popup(f))
              .addTo(lg)
          continue
        }
        if (f.kind === 'parit') {
          L.polyline(f.lines, { pane: 'nature', color: '#8b3a2b', weight: 3, opacity: 0.85, dashArray: '8 6' }).bindPopup(popup(f)).addTo(lg)
          const mid = f.lines[0][Math.floor(f.lines[0].length / 2)]
          if (zoom >= 13 && fits(mid, f.t, 12))
            L.marker(mid, { pane: 'nature', interactive: false, icon: L.divIcon({ className: '', iconSize: undefined, html: `<span class="nm-wadi-label nm-parit-label">${esc(f.t)} · jalur perkiraan</span>` }) }).addTo(lg)
          continue
        }
        if (f.kind === 'wadi') {
          L.polyline(f.lines, { pane: 'nature', color: '#e2cf9e', weight: 9, opacity: 0.75, lineCap: 'round', lineJoin: 'round' }).bindPopup(popup(f)).addTo(lg)
          L.polyline(f.lines, { pane: 'nature', color: '#6f8a8c', weight: 2, opacity: 0.9, dashArray: '1 5', lineCap: 'round' }).bindPopup(popup(f)).addTo(lg)
          const longest = [...f.lines].sort((a, b) => b.length - a.length)[0]
          const mid = longest[Math.floor(longest.length / 2)]
          if (zoom >= 12 && fits(mid, f.t, 12)) L.marker(mid, { pane: 'nature', interactive: false, icon: L.divIcon({ className: '', iconSize: undefined, html: `<span class="nm-wadi-label">${esc(f.t)}</span>` }) }).addTo(lg)
        } else {
          const look = f.kind === 'pasir' ? { color: '#b8925a', fill: 'url(#nm-sand)' } : f.kind === 'harrah' ? { color: '#3b2f2a', fill: 'url(#nm-lava)' } : { color: '#7a5c3a', fill: 'url(#nm-hatch)' }
          const shape = L.polygon(f.lines, { pane: 'nature', color: look.color, weight: f.kind === 'gunung' ? 1.2 : 0.8, fillColor: look.fill, fillOpacity: 1, className: 'nm-hatched' })
          shape
            .bindPopup(popup(f))
            .bindTooltip(esc(f.t), { direction: 'center', className: 'nm-mountain-label', permanent: zoom >= 12 && fits(shape.getBounds().getCenter(), f.t, 12) })
            .addTo(lg)
        }
        continue
      }
      if (f.lat == null || f.lon == null) continue
      const approxMark = f.precision === 'perkiraan' ? '≈ ' : ''
      if (f.kind === 'wilayah' || f.kind === 'laut') {
        // region and sea names frame the peninsula: only from afar
        if (zoom <= 8 && fits([f.lat, f.lon], f.t, f.kind === 'wilayah' ? 20 : 15))
          L.marker([f.lat, f.lon], { pane: 'nature', icon: L.divIcon({ className: '', iconSize: undefined, html: `<span class="${f.kind === 'wilayah' ? 'nm-region' : 'nm-sea'}">${approxMark}${esc(f.t)}</span>` }), title: f.t })
            .bindPopup(popup(f))
            .addTo(lg)
        continue
      }
      if (f.kind === 'pasir') {
        if (fits([f.lat, f.lon], f.t, 13))
          L.marker([f.lat, f.lon], { pane: 'nature', icon: L.divIcon({ className: '', iconSize: undefined, html: `<span class="nm-route-label">${medallion('pasir', '#b8925a', { approx: !!approxMark })}${approxMark}${esc(f.t)}</span>` }), title: f.t })
            .bindPopup(popup(f))
            .addTo(lg)
        continue
      }
      if (f.kind === 'kawasan') {
        // clan quarters: a spaced caption, only close up and where it fits (the books give no boundary)
        if (zoom >= 13 && fits([f.lat, f.lon], f.t, 11))
          L.marker([f.lat, f.lon], { pane: 'nature', icon: L.divIcon({ className: '', iconSize: undefined, html: `<span class="nm-kawasan">${approxMark}${esc(f.t)}</span>` }), title: f.t })
            .bindPopup(popup(f))
            .addTo(lg)
        continue
      }
      if (f.kind === 'benteng' || f.kind === 'pasar') {
        L.marker([f.lat, f.lon], { pane: 'nature', icon: L.divIcon({ className: '', iconSize: [16, 16], html: `<span class="${f.precision === 'perkiraan' ? 'nm-approx-ring' : ''}">${f.kind === 'benteng' ? TOWER : STALL}</span>` }), title: f.t })
          .bindTooltip(esc(f.t), { direction: 'right', offset: [6, 0], className: 'nm-mark-label', permanent: zoom >= 15 && fits([f.lat, f.lon], f.t, 11) })
          .bindPopup(popup(f))
          .addTo(lg)
        continue
      }
      // name-only features: harrah names always (they frame the city), gardens as a palm, the rest only where they fit
      if (f.kind === 'harrah') {
        if (!fits([f.lat, f.lon], f.t, 15)) continue
      } else if (f.kind !== 'kebun' && !(zoom >= 12 && fits([f.lat, f.lon], f.t, 12))) {
        L.marker([f.lat, f.lon], { pane: 'nature', icon: L.divIcon({ className: '', iconSize: [8, 8], html: '<span class="nm-dot"></span>' }), title: f.t })
          .bindTooltip(esc(f.t), { direction: 'right', className: 'nm-mark-label' })
          .bindPopup(popup(f))
          .addTo(lg)
        continue
      }
      const html =
        f.kind === 'harrah'
          ? `<span class="nm-harrah">${approxMark}${esc(f.t)}</span>`
          : f.kind === 'kebun'
            ? `<span class="nm-palm" title="${esc(f.t)}">${PALM}</span>`
            : `<span class="nm-mountain-label">${approxMark}${esc(f.t)}</span>`
      L.marker([f.lat, f.lon], { pane: 'nature', icon: L.divIcon({ className: '', iconSize: undefined, html }), title: f.t }).bindPopup(popup(f)).addTo(lg)
    }
    // patterns (mountain hatching, sand, lava), added once to the map's SVG
    const svg = m.getPanes().nature.querySelector('svg')
    if (svg && !svg.querySelector('#nm-sand')) svg.insertAdjacentHTML('afterbegin', PATTERNS)
  }, [shapes, zoom, base])

  // historical landmarks (era view): fanned out where they share a point, names shown only where they do not collide
  useEffect(() => {
    const lg = marks.current
    const m = map.current
    if (!lg || !m) return
    lg.clearLayers()
    if (zoom < LOCAL_ZOOM) return
    const groups = new Map<string, Place[]>()
    for (const p of landmarks) {
      if (p.lat == null) continue
      const k = `${p.lat.toFixed(4)},${p.lon!.toFixed(4)}`
      groups.set(k, [...(groups.get(k) ?? []), p])
    }
    const placed: L.Bounds[] = base === 'era' ? [...labelBoxes.current] : []
    const rows: { p: Place; at: L.LatLng }[] = []
    for (const ps of groups.values()) {
      const c = L.latLng(ps[0].lat!, ps[0].lon!)
      const pts = ps.length > 1 && zoom >= SPIDER_ZOOM ? fan(m, c, ps.length, 46, Math.PI / ps.length) : ps.map(() => c)
      ps.forEach((p, i) => {
        if (pts[i] !== c) L.polyline([c, pts[i]], { color: '#8a6a12', weight: 1, opacity: 0.6, interactive: false }).addTo(lg)
        rows.push({ p, at: pts[i] })
      })
    }
    // exact places get their label first
    rows.sort((a, b) => Number(a.p.precision === 'perkiraan') - Number(b.p.precision === 'perkiraan'))
    for (const { p, at } of rows) {
      const approx = p.precision === 'perkiraan'
      const pt = m.latLngToLayerPoint(at)
      const box = L.bounds([pt.x + 6, pt.y - 10], [pt.x + 18 + p.t.length * 6.2, pt.y + 10])
      const free = zoom >= LABEL_ZOOM && !placed.some((b) => b.intersects(box))
      if (free) placed.push(box)
      L.marker(at, { icon: L.divIcon({ className: '', iconSize: [20, 20], html: medallion(p.kind, '#8a6a12', { approx, gold: true }) }), title: p.t })
        .bindTooltip(esc(p.t), { permanent: free, direction: 'right', offset: [8, 0], className: 'nm-mark-label' })
        .bindPopup(`<div class="nm-pop"><div class="nm-entry">${placeHtml(p)}</div></div>`, { maxWidth: 320 })
        .addTo(lg)
    }
  }, [landmarks, zoom, base, shapes])

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
          <span className="inline-flex items-center gap-1.5">
            <span className="nm-zone-badge text-[10px]" style={{ transform: "none" }}>di suatu tempat di …</span> kitab hanya menyebut wilayahnya
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span dangerouslySetInnerHTML={{ __html: medallion('tanya', '#7a5c3a', { approx: true }) }} /> tempat kabilah yang letaknya belum diketahui
          </span>
          {base === 'era' && (
            <span className="inline-flex items-center gap-1.5">
              <span dangerouslySetInnerHTML={{ __html: medallion('masjid', '#8a6a12', { gold: true }) }} /> tempat bersejarah masa Nabi ﷺ (ikon = jenis tempat; buka "Legenda" untuk artinya)
            </span>
          )}
          {base === 'era' && (
            <span className="inline-flex items-center gap-1.5">
              <span className="nm-kawasan-sample">Dar Bani …</span> kawasan kabilah ·{' '}
              <span className="inline-block h-0 w-5 border-t-[3px] border-dashed border-[#8b3a2b]" /> Khandaq (jalur perkiraan)
            </span>
          )}
        </div>
        {base === 'era' && legend.length > 0 && (
          <details className="border-t border-krem-200 px-4 py-2 text-xs">
            <summary className="cursor-pointer font-semibold text-hijau-800">Legenda & arti istilah peta (bersitasi)</summary>
            <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {legend.map((x) => (
                <li key={`${x.kind}-${x.t}`} className="flex gap-2">
                  <span className="mt-0.5 shrink-0" dangerouslySetInnerHTML={{ __html: medallion(x.kind, '#8a6a12', { gold: true }) }} />
                  <span className="text-tinta">
                    <strong className="font-semibold text-hijau-900">{x.t}</strong>
                    {x.ar && (
                      <span dir="rtl" lang="ar" className="ar ml-1 text-sm">
                        {x.ar}
                      </span>
                    )}{' '}
                    — {x.note}
                    <SrcChips src={x.src} />
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
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
          {all.length} tempat bersitasi: {all.filter((e) => e.p.lat != null).length} bertitik, {all.filter((e) => e.p.lat == null && e.p.zone_lat != null).length} hanya diketahui wilayahnya (zona),{' '}
          {all.filter((e) => e.p.lat == null && e.p.zone_lat == null).length} belum diketahui letaknya (kartu "?"). Klik untuk kutipan kitabnya.
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
