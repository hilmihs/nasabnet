import { Empty, SectionTitle } from '../components/bits'
import { Icon } from '../components/Icon'
import { clearHistory, toggleBookmark, useSaved, type SavedItem } from '../lib/store'
import { useUI } from '../lib/ui'

const KIND_LABEL: Record<SavedItem['kind'], string> = { person: 'Profil', path: 'Diagram hubungan', lineage: 'Silsilah', tribe: 'Kabilah' }
const KIND_ICON = { person: 'user', path: 'route', lineage: 'tree', tribe: 'tribes' } as const

export function SavedView() {
  const { history, bookmarks } = useSaved()
  const { go, openProfile } = useUI()
  const open = (x: SavedItem) => {
    if (x.kind === 'person') openProfile(x.ref)
    else if (x.kind === 'tribe') go('kabilah', { t: x.ref })
    else if (x.kind === 'lineage') go('silsilah', { p: x.ref })
    else {
      const [a, b] = x.ref.split('|')
      go('relasi', { a, b })
    }
  }
  const Row = ({ x, removable }: { x: SavedItem; removable?: boolean }) => (
    <li className="flex items-center gap-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-hijau-50 text-hijau-700">
        <Icon name={KIND_ICON[x.kind]} className="h-4 w-4" />
      </span>
      <button type="button" onClick={() => open(x)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-tinta hover:text-hijau-700">{x.label}</span>
        <span className="block text-xs text-tinta-soft">
          {KIND_LABEL[x.kind]} · {new Date(x.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </button>
      {removable && (
        <button type="button" onClick={() => toggleBookmark(x)} className="rounded-lg p-1.5 text-tinta-soft hover:bg-krem-200" aria-label={`Hapus ${x.label} dari favorit`}>
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </li>
  )
  return (
    <div>
      <SectionTitle kicker="History & Bookmarks" title="Riwayat & Favorit">
        Profil, diagram hubungan, silsilah, dan kabilah yang Anda simpan atau buka akan tercatat di sini (tersimpan di peramban ini).
      </SectionTitle>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 font-display text-2xl font-semibold text-hijau-900">
            <Icon name="bookmark" className="h-5 w-5 text-emas-600" filled /> Favorit
          </h2>
          {bookmarks.length ? <ul className="divide-y divide-krem-200">{bookmarks.map((x) => <Row key={`${x.kind}${x.ref}`} x={x} removable />)}</ul> : <Empty>Belum ada favorit. Tekan “Simpan” pada profil, diagram, silsilah, atau kabilah.</Empty>}
        </section>
        <section className="card p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-hijau-900">
              <Icon name="history" className="h-5 w-5 text-emas-600" /> Riwayat penelusuran
            </h2>
            {history.length > 0 && (
              <button type="button" onClick={clearHistory} className="text-xs font-semibold text-emas-700 hover:underline">
                Bersihkan
              </button>
            )}
          </div>
          {history.length ? <ul className="divide-y divide-krem-200">{history.map((x) => <Row key={`${x.kind}${x.ref}`} x={x} />)}</ul> : <Empty>Riwayat masih kosong.</Empty>}
        </section>
      </div>
    </div>
  )
}
