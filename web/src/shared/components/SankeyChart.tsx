import { useMemo } from 'react'
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey'

export interface SankeyNode {
  id: string
  type: string
  label: string
}

export interface SankeyLink {
  source: string
  target: string
  choice_id: string
  label: string
  value: number
}

interface Props {
  nodes: SankeyNode[]
  links: SankeyLink[]
  highlightChoiceIds?: Set<string>
  width?: number
  height?: number
}

const TYPE_COLOR: Record<string, string> = {
  intro:  '#6366f1',
  text:   '#64748b',
  image:  '#8b5cf6',
  end:    '#10b981',
}

function truncate(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + '…' : (s || '')
}

export default function SankeyChart({ nodes, links, highlightChoiceIds, width = 580, height = 480 }: Props) {
  const { layoutNodes, layoutLinks } = useMemo(() => {
    if (!nodes.length) return { layoutNodes: [], layoutLinks: [] }

    const layout = sankey()
      .nodeId((d: any) => d.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(12)
      .nodePadding(10)
      .extent([[1, 5], [width - 140, height - 10]])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graph = layout({
      nodes: nodes.map(n => ({ ...n })),
      links: links.map(l => ({ ...l, value: Math.max(l.value, 0.5) })),
    } as any)

    return { layoutNodes: graph.nodes as any[], layoutLinks: graph.links as any[] }
  }, [nodes, links, width, height])

  const pathGen = sankeyLinkHorizontal()

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <g>
        {layoutLinks.map((link: any, i: number) => {
          const highlighted = highlightChoiceIds?.has(link.choice_id)
          return (
            <path
              key={i}
              d={pathGen(link) ?? ''}
              fill="none"
              stroke={highlighted ? '#c47b2a' : 'currentColor'}
              strokeWidth={Math.max(1, link.width ?? 1)}
              strokeOpacity={highlighted ? 0.65 : 0.12}
            />
          )
        })}
      </g>
      <g>
        {layoutNodes.map((node: any, i: number) => {
          const labelOnRight = node.x1 < width - 140
          const nodeH = Math.max(2, node.y1 - node.y0)
          return (
            <g key={i}>
              <rect
                x={node.x0} y={node.y0}
                width={node.x1 - node.x0}
                height={nodeH}
                fill={TYPE_COLOR[node.type] ?? '#888'}
                opacity={0.8}
                rx={2}
              />
              <text
                x={labelOnRight ? node.x1 + 5 : node.x0 - 5}
                y={node.y0 + nodeH / 2}
                textAnchor={labelOnRight ? 'start' : 'end'}
                fontSize={10}
                dominantBaseline="middle"
                fill="currentColor"
                opacity={0.6}
              >
                {truncate(node.label, 24)}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
