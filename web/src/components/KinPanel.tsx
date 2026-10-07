import { useMemo, useState } from 'react'
import { useStore } from '../lib/data'
import { allianceRelatives, familyRelatives, nasabRelatives } from '../lib/kin'
import type { Person } from '../lib/types'
import { PersonChip } from './bits'

type Tab = 'nasab' | 'kerabat' | 'aliansi'

/** Companions linked to one person by nasab, by family/marriage, and by tribal alliance. */
export function KinPanel({ p, title }: { p: Person; title?: string }) {
  const { g, ancestors, tribes } = useStore()
  const [tab, setTab] = useState<Tab>('nasab')
  const [more, setMore] = useState(false)
  const nasab = useMemo(() => nasabRelatives(g, ancestors, p, 4, 80), [g, ancestors, p])
  const family = useMemo(() => familyRelatives(g, p.id), [g, p])
  const alliance = useMemo(() => allianceRelatives(g, p.id), [g, p])
  const counts: Record<Tab, number> = { nasab: nasab.length, kerabat: family.length, aliansi: alliance.reduce((n, a) => n + a.links.length, 0) }
  const LIMIT = 12

  return (
    <section className="card min-w-0 p-4" aria-label={`Tokoh terkait ${p.lat}`}>
      <h3 className="font-display text-xl font-semibold text-hijau-900">{title ?? `Tokoh terkait ${p.lat}`}</h3>
      <div className="mt-2 mb-2 flex flex-wrap gap-1 text-xs font-semibold" role="tablist">
        {(
          [
            ['nasab', 'Se-nasab'],
            ['kerabat', 'Kekerabatan'],
            ['aliansi', 'Aliansi kabilah'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => (setTab(k), setMore(false))}
            className={`rounded-full border px-3 py-1 ${tab === k ? 'border-hijau-800 bg-hijau-800 text-krem-50' : 'border-krem-300 bg-white text-hijau-800'}`}
          >
            {label} <span className={tab === k ? 'text-emas-300' : 'text-tinta-soft'}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {tab === 'nasab' && (
        <>
          <p className="mb-1 text-xs text-tinta-soft">Sahabat yang segaris keturunan ayah (bertemu pada leluhur yang sama, hingga 4 generasi ke atas).</p>
          {nasab.length ? (
            <div className="grid sm:grid-cols-2">
              {(more ? nasab : nasab.slice(0, LIMIT)).map((k) => (
                <PersonChip key={k.id} id={k.id} sub={`${k.label} · via ${k.ancestor}`} />
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-tinta-soft/80 italic">Belum ada sahabat se-nasab yang tercatat.</p>
          )}
          {nasab.length > LIMIT && !more && <MoreBtn n={nasab.length - LIMIT} onClick={() => setMore(true)} />}
        </>
      )}

      {tab === 'kerabat' && (
        <>
          <p className="mb-1 text-xs text-tinta-soft">Keluarga inti, mertua, menantu, ipar, besan, cucu, dan paman/bibi.</p>
          {family.length ? (
            <div className="grid sm:grid-cols-2">
              {(more ? family : family.slice(0, LIMIT)).map((k) => (
                <PersonChip key={k.id} id={k.id} sub={k.label} />
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-tinta-soft/80 italic">Belum ada relasi keluarga yang tercatat.</p>
          )}
          {family.length > LIMIT && !more && <MoreBtn n={family.length - LIMIT} onClick={() => setMore(true)} />}
        </>
      )}

      {tab === 'aliansi' && (
        <>
          <p className="mb-1 text-xs text-tinta-soft">
            Kabilah lain yang terikat dengan keluarga {p.lat} melalui pernikahan, mu'akhah, atau wala'.
          </p>
          {alliance.length ? (
            <div className="space-y-2">
              {alliance.map((a) => (
                <div key={a.tribe}>
                  <p className="text-xs font-semibold text-emas-700">{tribes.get(a.tribe)?.name}</p>
                  <div className="grid sm:grid-cols-2">
                    {a.links.map((l) => (
                      <PersonChip key={l.other} id={l.other} sub={l.via === p.id ? l.relation : `${l.relation}: ${g.byId.get(l.via)?.lat}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-tinta-soft/80 italic">Belum ada aliansi antarkabilah yang tercatat.</p>
          )}
        </>
      )}
    </section>
  )
}

function MoreBtn({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-2 w-full rounded-xl bg-krem-200 py-1.5 text-xs font-semibold text-hijau-800">
      Tampilkan {n} lainnya
    </button>
  )
}

/** People related to both a and b (family ring or nasab kin) — the "kerabat bersama". */
export function SharedKin({ a, b }: { a: Person; b: Person }) {
  const { g, ancestors } = useStore()
  const shared = useMemo(() => {
    const ring = (p: Person) =>
      // family terms (istri, ipar, …) take precedence over the generic nasab label
      new Map<string, string>([
        ...nasabRelatives(g, ancestors, p, 3, 200).map((k) => [k.id, k.label] as [string, string]),
        ...familyRelatives(g, p.id).map((k) => [k.id, k.label] as [string, string]),
      ])
    const ra = ring(a)
    const rb = ring(b)
    return [...ra.keys()].filter((x) => rb.has(x) && x !== a.id && x !== b.id).map((x) => ({ id: x, la: ra.get(x)!, lb: rb.get(x)! }))
  }, [g, ancestors, a, b])
  if (!shared.length) return null
  return (
    <section className="card p-4">
      <h3 className="font-display text-xl font-semibold text-hijau-900">Kerabat bersama</h3>
      <p className="mb-1 text-xs text-tinta-soft">
        Tokoh yang berkerabat dengan {a.lat} sekaligus {b.lat}.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3">
        {shared.slice(0, 30).map((s) => (
          <PersonChip key={s.id} id={s.id} sub={`${s.la} / ${s.lb}`} />
        ))}
      </div>
    </section>
  )
}
