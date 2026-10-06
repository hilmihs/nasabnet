import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlobalSearch } from './components/GlobalSearch'
import { Icon } from './components/Icon'
import { ProfileCard } from './components/ProfileCard'
import { loadStore, StoreContext, type Store } from './lib/data'
import type { Category } from './lib/types'
import { parseHash, toHash, UIContext, type UI, type View } from './lib/ui'
import { GlossaryView } from './views/GlossaryView'
import { LineageView } from './views/LineageView'
import { LookupView } from './views/LookupView'
import { MatrimonialView } from './views/MatrimonialView'
import { SavedView } from './views/SavedView'
import { TribesView } from './views/TribesView'

const NAV: { view: View; label: string; short: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { view: 'kabilah', label: 'Peta Kabilah', short: 'Kabilah', icon: 'tribes' },
  { view: 'nikah', label: 'Jejaring Pernikahan', short: 'Nikah', icon: 'rings' },
  { view: 'relasi', label: 'Cari Hubungan', short: 'Relasi', icon: 'route' },
  { view: 'silsilah', label: 'Silsilah Vertikal', short: 'Silsilah', icon: 'tree' },
  { view: 'glosarium', label: 'Glosarium & Rujukan', short: 'Glosarium', icon: 'book' },
  { view: 'tersimpan', label: 'Riwayat & Favorit', short: 'Simpanan', icon: 'bookmark' },
]

export default function App() {
  const [store, setStore] = useState<Store | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  const [profile, setProfile] = useState<string | null>(null)
  const [filters, setFilters] = useState<Category[]>([])

  useEffect(() => {
    loadStore().then(setStore, (e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((view: View, params: Record<string, string> = {}) => {
    setProfile(null)
    window.location.hash = toHash(view, params)
  }, [])
  const closeProfile = useCallback(() => setProfile(null), [])

  const ui: UI = useMemo(() => ({ route, go, openProfile: setProfile, filters, setFilters }), [route, go, filters])

  if (error)
    return (
      <div className="grid min-h-full place-items-center p-6 text-center">
        <div>
          <p className="font-display text-3xl text-hijau-900">Data belum tersedia</p>
          <p className="mt-2 text-sm text-tinta-soft">{error}. Jalankan pipeline data terlebih dahulu (lihat README).</p>
        </div>
      </div>
    )

  if (!store)
    return (
      <div className="pattern-bg grid min-h-full place-items-center text-krem-50">
        <div className="text-center">
          <Logo />
          <p className="mt-4 animate-pulse text-sm text-emas-300">Memuat jejaring nasab…</p>
        </div>
      </div>
    )

  const View = { kabilah: TribesView, nikah: MatrimonialView, relasi: LookupView, silsilah: LineageView, glosarium: GlossaryView, tersimpan: SavedView }[route.view]

  return (
    <StoreContext.Provider value={store}>
      <UIContext.Provider value={ui}>
        <div className="flex min-h-full flex-col">
          <header className="pattern-bg sticky top-0 z-40 border-b border-emas-400/20 shadow-lg">
            <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
              <a href="#/kabilah" className="shrink-0" aria-label="NasabNet beranda">
                <Logo compact />
              </a>
              <div className="flex flex-1 justify-end md:justify-center">
                <GlobalSearch />
              </div>
            </div>
            <nav className="mx-auto hidden max-w-7xl gap-1 px-4 pb-2 sm:px-6 md:flex" aria-label="Navigasi utama">
              {NAV.map((n) => (
                <a
                  key={n.view}
                  href={toHash(n.view)}
                  aria-current={route.view === n.view ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    route.view === n.view ? 'bg-emas-400 text-hijau-950' : 'text-krem-200 hover:bg-white/10 hover:text-krem-50'
                  }`}
                >
                  <Icon name={n.icon} className="h-4 w-4" />
                  {n.label}
                </a>
              ))}
            </nav>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-12">
            <View />
          </main>

          <footer className="hidden border-t border-krem-300 bg-krem-200/50 md:block">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-tinta-soft">
              <span>
                NasabNet · data dari basis rawi & kitab klasik di{' '}
                <a href="https://app.turath.io" target="_blank" rel="noreferrer" className="font-semibold text-hijau-700 hover:underline">
                  Turath.io
                </a>{' '}
                (Thabaqat Ibnu Sa'd, al-Ishabah, dll.)
              </span>
              <span>
                Untuk edukasi — selalu rujuk kitab aslinya ·{' '}
                <a href="https://github.com/hilmihs/nasabnet" target="_blank" rel="noreferrer" className="font-semibold text-hijau-700 hover:underline">
                  Kode sumber
                </a>
              </span>
            </div>
          </footer>

          <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-emas-400/20 bg-hijau-900 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navigasi bawah">
            {NAV.map((n) => (
              <a
                key={n.view}
                href={toHash(n.view)}
                aria-current={route.view === n.view ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${route.view === n.view ? 'text-emas-300' : 'text-krem-200/70'}`}
              >
                <Icon name={n.icon} className="h-5 w-5" />
                {n.short}
              </a>
            ))}
          </nav>
        </div>
        {profile && <ProfileCard id={profile} onClose={closeProfile} />}
      </UIContext.Provider>
    </StoreContext.Provider>
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className={compact ? 'h-9 w-9' : 'h-14 w-14'} aria-hidden="true">
        <g fill="none" stroke="#d4af37" strokeWidth="3">
          <path d="M32 6l6.9 9.5 11.1-3.6-3.6 11.1L56 30l-9.6 6.9 3.6 11.1-11.1-3.6L32 54l-6.9-9.6-11.1 3.6 3.6-11.1L8 30l9.6-6.9-3.6-11.1 11.1 3.6z" />
          <circle cx="32" cy="30" r="5" fill="#d4af37" />
          <path d="M32 35v8M27 39h10" />
        </g>
      </svg>
      <span className="leading-none">
        <span className={`block font-display font-bold tracking-wide text-krem-50 ${compact ? 'text-2xl' : 'text-4xl'}`}>
          Nasab<span className="text-emas-400">Net</span>
        </span>
        {!compact && <span className="mt-1 block text-xs tracking-[0.25em] text-emas-300 uppercase">Jejaring Kabilah & Sahabat Nabi</span>}
        {compact && <span className="hidden text-[10px] tracking-[0.2em] text-emas-300/90 uppercase sm:block">Kabilah & Sahabat Nabi</span>}
      </span>
    </span>
  )
}
