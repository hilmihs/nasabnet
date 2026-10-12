import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { citationUrl, useBio, type Place } from '../lib/bio'
import { useStore } from '../lib/data'
import type { Tribe } from '../lib/types'

const GROUP_LABEL: Record<Tribe['group'], string> = { quraisy: 'Quraisy', anshar: 'Anshar', arab: 'Arab lain', ajam: 'Non-Arab' }

interface Entry {
  tid: string
  p: Place
}
interface Spot {
  key: string
  lat: number
  lon: number
  entries: Entry[]
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Cited places of every tribe on a map; a point opens what the book says and links to the tribe profile. */
export default function TribeMap({ focus, onSelect }: { focus?: string; onSelect: (tid: string) => void }) {
  const bio = useBio()
  const { g, tribes, tribeColorById } = useStore()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const [groups, setGroups] = useState<Set<Tribe['group']>>(new Set(['quraisy', 'anshar', 'arab', 'ajam']))
  const [hover, setHover] = useState<string | null>(null)
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])

  const all = useMemo(() => {
    const out: Entry[] = []
    for (const [tid, t] of Object.entries(bio?.tribes ?? {})) for (const p of t.tempat ?? []) out.push({ tid, p })
    return out
  }, [bio])

  const visible = useMemo(() => all.filter((e) => e.p.lat != null && groups.has(tribes.get(e.tid)?.group ?? 'arab')), [all, groups, tribes])
  const spots = useMemo(() => {
    const m = new Map<string, Spot>()
    for (const e of visible) {
      const key = `${e.p.lat!.toFixed(3)},${e.p.lon!.toFixed(3)}`
      const s = m.get(key) ?? { key, lat: e.p.lat!, lon: e.p.lon!, entries: [] }
      s.entries.push(e)
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
    const m = L.map(box.current, { center: [23.5, 43], zoom: 5, minZoom: 3, maxZoom: 18, scrollWheelZoom: false, worldCopyJump: true })
    const esri = (name: string, opts: L.TileLayerOptions = {}) =>
      L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${name}/MapServer/tile/{z}/{y}/{x}`, {
        attribution: 'Tiles &copy; Esri · koordinat: Wikidata &amp; &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
        ...opts,
      })
    // World_Physical_Map only exists up to zoom 8: past that, switch to satellite imagery (sharp down to street level)
    const relief = L.layerGroup([
      esri('World_Physical_Map', { maxZoom: 8 }),
      esri('World_Imagery', { minZoom: 9 }),
      esri('Reference/World_Boundaries_and_Places', { minZoom: 9, pane: 'overlayPane' }),
    ])
    const satellite = L.layerGroup([esri('World_Imagery'), esri('Reference/World_Boundaries_and_Places', { pane: 'overlayPane' })])
    const topo = esri('World_Topo_Map')
    relief.addTo(m)
    L.control
      .layers({ 'Relief alam (dekat: satelit)': relief, 'Citra satelit': satellite, 'Topografi (nama tempat modern)': topo }, undefined, { position: 'topright' })
      .addTo(m)
    m.on('focus', () => m.scrollWheelZoom.enable())
    m.on('blur', () => m.scrollWheelZoom.disable())
    layer.current = L.layerGroup().addTo(m)
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

  // draw markers
  useEffect(() => {
    const lg = layer.current
    if (!lg) return
    lg.clearLayers()
    const hl = hover ?? focus
    for (const s of spots) {
      const tids = [...new Set(s.entries.map((e) => e.tid))]
      const on = !hl || tids.includes(hl)
      const approx = s.entries.every((e) => e.p.precision === 'perkiraan')
      const color = tids.length === 1 ? tribeColorById(tids[0]) : '#0f3b2e'
      const size = tids.length > 1 ? 22 : 14
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:999px;background:${approx ? 'rgba(255,255,255,.85)' : color};border:2px ${approx ? 'dashed' : 'solid'} ${approx ? color : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fcfaf4;font:700 10px/1 'Plus Jakarta Sans',sans-serif;opacity:${on ? 1 : 0.25}">${tids.length > 1 ? tids.length : ''}</span>`,
      })
      const html = [...s.entries]
        .sort((a, b) => Number(b.tid === hl) - Number(a.tid === hl))
        .map(({ tid, p }) => {
          const t = tribes.get(tid)
          const srcs = (p.src ?? [])
            .map((x) => {
              const u = citationUrl(x)
              return u ? `<a href="${u}" target="_blank" rel="noreferrer">${esc(x)}</a>` : esc(x)
            })
            .join(' · ')
          return `<div class="nm-entry">
            <div class="nm-head"><strong>${esc(p.t)}</strong> <span class="nm-ar" dir="rtl">${esc(p.ar)}</span></div>
            <div class="nm-meta">${esc(p.kind)}${p.precision === 'perkiraan' ? ` · titik perkiraan (dekat ${esc(p.near ?? '')})` : ''}</div>
            <div>${esc(p.note)}</div>
            <div class="nm-src">ⓘ ${srcs}</div>
            <button type="button" data-tid="${tid}" class="nm-tribe" style="border-color:${tribeColorById(tid)}">${esc(t?.name ?? tid)} — buka profil</button>
          </div>`
        })
        .join('')
      L.marker([s.lat, s.lon], { icon, zIndexOffset: on ? 1000 : 0, title: s.entries.map((e) => e.p.t).join(' / ') })
        .bindPopup(`<div class="nm-pop">${html}</div>`, { maxWidth: 320, maxHeight: 360 })
        .addTo(lg)
    }
  }, [spots, focus, hover, tribes, tribeColorById])

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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="card overflow-hidden p-0">
        <div ref={box} className="h-[68vh] min-h-[420px] w-full bg-krem-100" aria-label="Peta wilayah kabilah" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-krem-200 px-4 py-2 text-xs text-tinta-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-white bg-hijau-700 shadow" /> titik tepat (Wikidata/OpenStreetMap)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-dashed border-hijau-700 bg-white" /> perkiraan (kitab hanya menyebut "dekat …")
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-hijau-800 text-[9px] font-bold text-krem-50">2</span> beberapa kabilah di satu titik
          </span>
        </div>
      </div>
      <aside className="card flex max-h-[calc(68vh+2.5rem)] flex-col p-4">
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
