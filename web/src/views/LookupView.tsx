import { useEffect, useMemo, useState } from 'react'
import { Empty, SectionTitle } from '../components/bits'
import { Icon } from '../components/Icon'
import { KinPanel, SharedKin } from '../components/KinPanel'
import { PathDiagram } from '../components/PathDiagram'
import { PersonPicker } from '../components/PersonPicker'
import { useStore } from '../lib/data'
import { commonAncestor, findPath, hopLabel, kinshipTerm } from '../lib/graph'
import { pushHistory, toggleBookmark, useSaved } from '../lib/store'
import { useUI } from '../lib/ui'

// Turath narrator ids (n…) are stable across rebuilds
const EXAMPLES: [string, string, string][] = [
  ['Ali ↔ Umar', 'n4500', 'n4677'],
  ['Abu Bakar ↔ Utsman', 'n3783', 'n4307'],
  ['Zubair ↔ Nabi ﷺ', 'n2065', 'nabi'],
  ['Thalhah ↔ Aisyah', 'n3000', 'n3026'],
]

export function LookupView() {
  const { g } = useStore()
  const { route, go } = useUI()
  const { isBookmarked } = useSaved()
  const a = route.params.a && g.byId.has(route.params.a) ? route.params.a : null
  const b = route.params.b && g.byId.has(route.params.b) ? route.params.b : null
  const [social, setSocial] = useState(false)
  const set = (k: 'a' | 'b', v: string | null) => go('relasi', { a: k === 'a' ? (v ?? '') : (a ?? ''), b: k === 'b' ? (v ?? '') : (b ?? '') })

  const result = useMemo(() => {
    if (!a || !b) return null
    const path = findPath(g, a, b, { social, maxDepth: 12 })
    const pa = g.byId.get(a)!
    const pb = g.byId.get(b)!
    const anc = commonAncestor(pa, pb)
    return { path, anc, pa, pb }
  }, [a, b, social, g])

  useEffect(() => {
    if (result?.path) pushHistory({ kind: 'path', ref: `${a}|${b}`, label: `${result.pa.lat} ↔ ${result.pb.lat}` })
  }, [result, a, b])

  const runExample = (x: string, y: string) => {
    if (g.byId.has(x) && g.byId.has(y)) go('relasi', { a: x, b: y })
  }

  const term = result?.path && result.path.length ? kinshipTerm(g, result.path) : null
  const pathRef = a && b ? `${a}|${b}` : ''

  return (
    <div>
      <SectionTitle kicker="Quick Relationship Lookup · Pathfinder" title="Mesin Pencari Hubungan">
        Pilih dua nama secara bebas. NasabNet menelusuri jaringan keluarga (orang tua, anak, pernikahan, saudara) untuk menemukan jalur terpendek, lalu
        menamai hubungannya — mertua, ipar, besan, sepupu — serta titik temu nasab patrilineal keduanya.
      </SectionTitle>

      <div className="card p-4 sm:p-5">
        <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
          <PersonPicker label="Tokoh pertama" value={a} onChange={(v) => set('a', v)} />
          <button
            type="button"
            onClick={() => go('relasi', { a: b ?? '', b: a ?? '' })}
            className="mx-auto mb-1 grid h-10 w-10 place-items-center rounded-full border border-krem-300 bg-white text-hijau-700 hover:border-hijau-600"
            aria-label="Tukar posisi"
          >
            <Icon name="swap" className="h-4 w-4" />
          </button>
          <PersonPicker label="Tokoh kedua" value={b} onChange={(v) => set('b', v)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="mr-2 inline-flex cursor-pointer items-center gap-2 text-sm text-tinta">
            <input type="checkbox" checked={social} onChange={(e) => setSocial(e.target.checked)} className="h-4 w-4 accent-hijau-700" />
            Sertakan mu'akhah &amp; wala'
          </label>
          <span className="text-xs text-tinta-soft">Contoh:</span>
          {EXAMPLES.filter(([, x, y]) => g.byId.has(x) && g.byId.has(y)).map(([label, x, y]) => (
            <button key={label} type="button" onClick={() => runExample(x, y)} className="rounded-full bg-krem-200 px-3 py-1 text-xs font-medium text-hijau-800 hover:bg-emas-100">
              {label}
            </button>
          ))}
        </div>
      </div>

      {!result && <div className="mt-6"><Empty>Pilih dua tokoh untuk melihat diagram garis hubungan mereka.</Empty></div>}

      {result && (
        <div className="mt-6 space-y-5">
          <div className="card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Diagram Garis Hubungan</p>
                {result.path ? (
                  <h2 className="mt-1 font-display text-2xl font-semibold text-hijau-900">
                    {result.path.length === 0
                      ? 'Orang yang sama'
                      : term
                        ? (
                            <>
                              {result.pb.lat} adalah <span className="text-emas-600">{term}</span> dari {result.pa.lat}
                            </>
                          )
                        : `Terhubung melalui ${result.path.length} langkah`}
                  </h2>
                ) : (
                  <h2 className="mt-1 font-display text-2xl font-semibold text-hijau-900">Belum ditemukan jalur keluarga dalam data</h2>
                )}
              </div>
              {result.path && pathRef && (
                <button
                  type="button"
                  onClick={() => toggleBookmark({ kind: 'path', ref: pathRef, label: `${result.pa.lat} ↔ ${result.pb.lat}` })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${isBookmarked('path', pathRef) ? 'border-emas-500 bg-emas-100 text-emas-700' : 'border-krem-300 bg-white text-hijau-800'}`}
                >
                  <Icon name="bookmark" className="h-4 w-4" filled={isBookmarked('path', pathRef)} />
                  {isBookmarked('path', pathRef) ? 'Diagram tersimpan' : 'Simpan diagram'}
                </button>
              )}
            </div>
            {result.path && result.path.length > 0 && (
              <>
                <PathDiagram start={a!} path={result.path} />
                <p className="mt-4 text-sm leading-relaxed text-tinta-soft">
                  <span className="font-semibold text-tinta">Bacaan jalur:</span>{' '}
                  {[a!, ...result.path.map((h) => h.to)].slice(0, -1).map((id, i) => (
                    <span key={i}>
                      {i > 0 && ' → '}
                      {hopLabel(g, result.path![i])} dari {g.byId.get(id)!.lat} adalah {g.byId.get(result.path![i].to)!.lat}
                    </span>
                  ))}
                  .
                </p>
                <SourcesOfPath path={result.path} />
              </>
            )}
            {!result.path && (
              <p className="text-sm text-tinta-soft">
                Data relasi yang terekstrak belum menghubungkan kedua tokoh ini{social ? '' : ' (coba aktifkan opsi mu\'akhah & wala\')'}. Lihat titik temu nasab di bawah.
              </p>
            )}
          </div>

          <div className="card p-5">
            <p className="text-xs font-semibold tracking-[0.18em] text-emas-600 uppercase">Titik Temu Nasab (patrilineal)</p>
            {result.anc ? (
              <div className="mt-2">
                <p className="font-display text-2xl font-semibold text-hijau-900">
                  Bertemu pada <span className="ar text-emas-600">{result.anc.name}</span>
                </p>
                <p className="mt-1 text-sm text-tinta-soft">
                  {result.pa.lat}: {result.anc.upA} generasi ke atas · {result.pb.lat}: {result.anc.upB} generasi ke atas. Bandingkan di{' '}
                  <button className="font-semibold text-hijau-700 hover:underline" onClick={() => go('silsilah', { p: a!, c: b! })}>
                    Silsilah Vertikal
                  </button>
                  .
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-tinta-soft">Rantai nasab yang tercatat untuk keduanya belum bertemu (rantai terlalu pendek atau berbeda kabilah besar).</p>
            )}
          </div>
        </div>
      )}
      {result && (
        <div className="mt-8">
          <h2 className="mb-1 font-display text-2xl font-semibold text-hijau-900">Tokoh terkait</h2>
          <p className="mb-3 text-sm text-tinta-soft">
            Sahabat yang berkaitan dengan kedua tokoh pencarian secara nasab (segaris keturunan ayah), kekerabatan (keluarga & pernikahan), dan aliansi kabilah.
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <KinPanel p={result.pa} />
            <KinPanel p={result.pb} />
          </div>
          <div className="mt-6">
            <SharedKin a={result.pa} b={result.pb} />
          </div>
        </div>
      )}
    </div>
  )
}

function SourcesOfPath({ path }: { path: ReturnType<typeof findPath> }) {
  const srcs = new Map<string, { t: string; url?: string }>()
  for (const h of path ?? []) if (h.edge.src) srcs.set(h.edge.src.t, h.edge.src)
  if (!srcs.size) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <span className="font-semibold text-tinta-soft">Sumber tiap tautan:</span>
      {[...srcs.values()].map((s) =>
        s.url ? (
          <a key={s.t} href={s.url} target="_blank" rel="noreferrer" className="rounded-full bg-hijau-50 px-2.5 py-0.5 text-hijau-700 hover:underline">
            {s.t}
          </a>
        ) : (
          <span key={s.t} className="rounded-full bg-krem-200 px-2.5 py-0.5">{s.t}</span>
        ),
      )}
    </div>
  )
}
