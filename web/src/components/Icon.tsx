const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm10 17-5.2-5.2',
  tribes: 'M12 3l2.6 4.4L19.5 6l-1.4 4.9L22 13.5l-4.6 1.6.6 5-4.6-2.2L12 21l-1.4-3.1L6 20.1l.6-5L2 13.5l3.9-2.6L4.5 6l4.9 1.4z',
  rings: 'M9 8a6 6 0 1 0 0 12A6 6 0 0 0 9 8zm6-4a6 6 0 0 1 0 12m-3-14 1.5 2.5L12 7',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h4m4 4v6a4 4 0 0 1-4 4h-4',
  tree: 'M12 3v18M12 7H7v4M12 7h5v4M7 11H4v4M7 11h3v4M17 11h-3v4M17 11h3v4',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0v16M8 7h7M8 11h5',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2',
  x: 'M6 6l12 12M18 6 6 18',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  external: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-11v6m0-9.5v.5',
  chevron: 'm9 6 6 6-6 6',
  up: 'm6 15 6-6 6 6',
  network: 'M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 5v6m0 0-6 6m6-6 6 6',
}

export function Icon({ name, className = 'h-5 w-5', filled = false }: { name: keyof typeof PATHS; className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
