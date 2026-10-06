import cytoscape, { type Core, type ElementDefinition, type LayoutOptions } from 'cytoscape'
import { useEffect, useRef } from 'react'

export interface GNode {
  id: string
  label: string
  color: string
  size?: number
  parent?: string
  female?: boolean
  focus?: boolean
  dim?: boolean
  compound?: boolean
}

export interface GEdge {
  id: string
  source: string
  target: string
  kind: 'parent' | 'spouse' | 'sibling' | 'muakhah' | 'mawla' | 'milk' | 'alliance'
  label?: string
  weight?: number
}

const EDGE_STYLE: Record<GEdge['kind'], { color: string; style: 'solid' | 'dashed' | 'dotted'; arrow: boolean }> = {
  parent: { color: '#1d6a54', style: 'solid', arrow: true },
  spouse: { color: '#c49b2a', style: 'solid', arrow: false },
  sibling: { color: '#7a8a82', style: 'dotted', arrow: false },
  muakhah: { color: '#6b5b3e', style: 'dashed', arrow: false },
  mawla: { color: '#5a6b78', style: 'dashed', arrow: true },
  milk: { color: '#9aa59f', style: 'dotted', arrow: false },
  alliance: { color: '#c49b2a', style: 'solid', arrow: false },
}

export function GraphCanvas({
  nodes,
  edges,
  layout = 'cose',
  onNodeClick,
  height = 560,
  ariaLabel,
}: {
  nodes: GNode[]
  edges: GEdge[]
  layout?: 'cose' | 'concentric' | 'breadthfirst' | 'circle'
  onNodeClick?: (id: string) => void
  height?: number | string
  ariaLabel: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const cy = useRef<Core | null>(null)
  const clickRef = useRef(onNodeClick)
  useEffect(() => {
    clickRef.current = onNodeClick
  }, [onNodeClick])

  useEffect(() => {
    if (!host.current) return
    const els: ElementDefinition[] = [
      ...nodes.map((n) => ({
        data: { id: n.id, label: n.label, color: n.color, size: n.size ?? 28, parent: n.parent },
        classes: [n.female ? 'f' : '', n.focus ? 'focus' : '', n.dim ? 'dim' : '', n.compound ? 'compound' : ''].join(' '),
      })),
      ...edges.map((e) => ({
        data: { id: e.id, source: e.source, target: e.target, label: e.label ?? '', w: e.weight ?? 1, ...EDGE_STYLE[e.kind] },
        classes: e.kind,
      })),
    ]
    const layoutOpts: LayoutOptions =
      layout === 'cose'
        ? ({ name: 'cose', animate: false, nodeRepulsion: () => 9000, idealEdgeLength: () => 70, gravity: 0.25, numIter: nodes.length > 120 ? 400 : 1000, padding: 24 } as LayoutOptions)
        : layout === 'concentric'
          ? ({ name: 'concentric', animate: false, minNodeSpacing: 18, concentric: (n: cytoscape.NodeSingular) => (n.hasClass('focus') ? 10 : n.degree(false)), levelWidth: () => 2, padding: 24 } as LayoutOptions)
          : ({ name: layout, animate: false, padding: 24, directed: true, spacingFactor: 1.1 } as LayoutOptions)

    const instance = cytoscape({
      container: host.current,
      elements: els,
      userZoomingEnabled: false,
      minZoom: 0.15,
      maxZoom: 3,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            width: 'data(size)',
            height: 'data(size)',
            label: 'data(label)',
            'font-family': 'Plus Jakarta Sans, sans-serif',
            'font-size': 10,
            color: '#1f2a25',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'text-wrap': 'ellipsis',
            'text-max-width': '110px',
            'text-background-color': '#fcfaf4',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
            'border-width': 2,
            'border-color': '#fcfaf4',
          },
        },
        { selector: 'node.f', style: { shape: 'round-diamond' } },
        { selector: 'node.focus', style: { 'border-color': '#d4af37', 'border-width': 4, 'font-weight': 700, 'font-size': 12 } },
        { selector: 'node.dim', style: { opacity: 0.35 } },
        {
          selector: 'node.compound',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.06,
            'border-color': 'data(color)',
            'border-width': 1.5,
            'border-style': 'dashed',
            shape: 'round-rectangle',
            label: 'data(label)',
            'text-valign': 'top',
            'font-size': 13,
            'font-weight': 700,
            color: '#0f3b2e',
            'text-background-opacity': 0,
            padding: '14px',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.6,
            'line-color': 'data(color)',
            'line-style': 'data(style)' as never,
            'curve-style': 'bezier',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'none',
            opacity: 0.85,
          },
        },
        { selector: 'edge.parent, edge.mawla', style: { 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8 } },
        { selector: 'edge.spouse', style: { width: 2.6 } },
        { selector: 'edge.alliance', style: { width: 'mapData(w, 1, 8, 1.5, 9)' as never, label: 'data(label)', 'font-size': 9, 'text-rotation': 'autorotate', color: '#8a6a12', 'text-background-color': '#fcfaf4', 'text-background-opacity': 0.9 } },
        { selector: 'node:selected', style: { 'border-color': '#d4af37', 'border-width': 4 } },
        { selector: '.faded', style: { opacity: 0.12 } },
      ],
      layout: layoutOpts,
    })
    instance.on('tap', 'node', (evt) => {
      const n = evt.target
      if (n.hasClass('compound')) return
      clickRef.current?.(n.id())
    })
    instance.on('mouseover', 'node', (evt) => {
      const n = evt.target
      if (n.hasClass('compound')) return
      const hood = n.closedNeighborhood()
      instance.elements().not(hood).not('.compound').addClass('faded')
    })
    instance.on('mouseout', 'node', () => instance.elements().removeClass('faded'))
    cy.current = instance
    return () => {
      instance.destroy()
      cy.current = null
    }
  }, [nodes, edges, layout])

  return (
    <div className="relative">
      <div ref={host} role="img" aria-label={ariaLabel} style={{ height }} className="w-full rounded-2xl bg-[radial-gradient(circle_at_center,#fcfaf4,#f3ecdc)]" />
      <div className="absolute right-3 bottom-3 flex gap-1">
        {(['+', '−'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-label={s === '+' ? 'Perbesar' : 'Perkecil'}
            className="w-8 rounded-lg border border-krem-300 bg-white/90 py-1 text-sm font-bold text-hijau-800 shadow-sm hover:bg-white"
            onClick={() => {
              const c = cy.current
              if (!c) return
              const z = c.zoom() * (s === '+' ? 1.25 : 0.8)
              c.zoom({ level: z, renderedPosition: { x: c.width() / 2, y: c.height() / 2 } })
            }}
          >
            {s}
          </button>
        ))}
        <button type="button" className="rounded-lg border border-krem-300 bg-white/90 px-2.5 py-1 text-xs font-semibold text-hijau-800 shadow-sm hover:bg-white" onClick={() => cy.current?.fit(undefined, 24)}>
          Pas layar
        </button>
      </div>
    </div>
  )
}

export function Legend({ kinds }: { kinds: GEdge['kind'][] }) {
  const names: Record<GEdge['kind'], string> = {
    parent: 'orang tua → anak',
    spouse: 'pernikahan',
    sibling: 'saudara',
    muakhah: "mu'akhah",
    mawla: "wala'",
    milk: 'sepersusuan',
    alliance: 'aliansi pernikahan antarklan',
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-soft">
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <svg width="26" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="25" y2="4" stroke={EDGE_STYLE[k].color} strokeWidth={k === 'spouse' || k === 'alliance' ? 3 : 2} strokeDasharray={EDGE_STYLE[k].style === 'dashed' ? '5 3' : EDGE_STYLE[k].style === 'dotted' ? '1.5 3' : undefined} />
          </svg>
          {names[k]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-hijau-700" /> laki-laki
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rotate-45 rounded-[2px] bg-hijau-700" /> perempuan
      </span>
    </div>
  )
}
