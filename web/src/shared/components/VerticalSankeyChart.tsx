import { useMemo } from 'react'
import type { SankeyNode, SankeyLink } from './SankeyChart.js'

interface Props {
  nodes: SankeyNode[]
  links: SankeyLink[]
  highlightChoiceIds?: Set<string>
  width?: number
  height?: number
}

interface NodeSlice {
  id: string
  type: string
  depth: number
  left: number   // x position within level bar
  right: number
  y: number      // vertical center of level bar
}

interface Band {
  choiceId: string
  srcLeft: number; srcRight: number; srcY: number
  tgtLeft: number; tgtRight: number; tgtY: number
}

/**
 * Vertical Sankey. Each depth level = one full-width bar.
 * Nodes at the same depth divide the bar proportionally by flow.
 * Bands flow between the proportional slices — no overlap.
 */
export default function VerticalSankeyChart({ nodes, links, highlightChoiceIds, width = 320, height = 480 }: Props) {
  const barH = 6
  const bandGap = 10 // px gap between adjacent bands

  const { bands, nodeRects } = useMemo(() => {
    if (!nodes.length) return { bands: [] as Band[], nodeRects: [] as { left: number; right: number; y: number }[] }

    // Adjacency
    const outLinks = new Map<string, SankeyLink[]>()
    const inLinks = new Map<string, SankeyLink[]>()
    for (const l of links) {
      if (!outLinks.has(l.source)) outLinks.set(l.source, [])
      outLinks.get(l.source)!.push(l)
      if (!inLinks.has(l.target)) inLinks.set(l.target, [])
      inLinks.get(l.target)!.push(l)
    }

    // BFS to assign depths
    const hasIncoming = new Set(links.map(l => l.target))
    const root = nodes.find(n => !hasIncoming.has(n.id))
    if (!root) return { slices: [] as NodeSlice[], bands: [] as Band[], levelYs: [] as number[] }

    const depthMap = new Map<string, number>()
    const queue = [root.id]
    depthMap.set(root.id, 0)
    let maxDepth = 0
    while (queue.length) {
      const id = queue.shift()!
      const d = depthMap.get(id)!
      for (const edge of (outLinks.get(id) ?? [])) {
        if (!depthMap.has(edge.target)) {
          depthMap.set(edge.target, d + 1)
          maxDepth = Math.max(maxDepth, d + 1)
          queue.push(edge.target)
        }
      }
    }

    // Total flow into each node (root uses outgoing total)
    const nodeFlow = new Map<string, number>()
    for (const n of nodes) {
      const incoming = inLinks.get(n.id) ?? []
      const total = incoming.reduce((s, l) => s + Math.max(l.value, 0.5), 0)
      if (total > 0) {
        nodeFlow.set(n.id, total)
      } else {
        // Root: use outgoing
        const outgoing = outLinks.get(n.id) ?? []
        nodeFlow.set(n.id, outgoing.reduce((s, l) => s + Math.max(l.value, 0.5), 0) || 1)
      }
    }

    // Group nodes by depth, sort by BFS discovery order (stable)
    const levels: string[][] = []
    for (let d = 0; d <= maxDepth; d++) levels.push([])
    // BFS order ensures consistent left-to-right
    const visited = new Set<string>()
    const bfsOrder: string[] = []
    const q2 = [root.id]
    visited.add(root.id)
    while (q2.length) {
      const id = q2.shift()!
      bfsOrder.push(id)
      for (const edge of (outLinks.get(id) ?? [])) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target)
          q2.push(edge.target)
        }
      }
    }
    for (const id of bfsOrder) {
      const d = depthMap.get(id) ?? 0
      levels[d].push(id)
    }

    // Vertical positions
    const barH = 6
    const gap = 20
    const totalLevels = maxDepth + 1
    const usable = height - gap * 2
    const spacing = totalLevels > 1 ? usable / (totalLevels - 1) : 0
    const yPositions = levels.map((_, i) => gap + i * spacing)

    // Assign horizontal slices per level with gaps between nodes
    const nodeSlice = new Map<string, { left: number; right: number }>()
    for (let d = 0; d <= maxDepth; d++) {
      const levelNodes = levels[d]
      const numGaps = Math.max(0, levelNodes.length - 1)
      const gapSpace = numGaps * bandGap
      const usableW = width - gapSpace
      const totalFlow = levelNodes.reduce((s, id) => s + (nodeFlow.get(id) ?? 1), 0)
      let cursor = 0
      for (let ni = 0; ni < levelNodes.length; ni++) {
        const id = levelNodes[ni]
        const flow = nodeFlow.get(id) ?? 1
        const left = cursor
        const sliceW = (flow / totalFlow) * usableW
        const right = cursor + sliceW
        nodeSlice.set(id, { left, right })
        cursor = right + bandGap
      }
    }

    // Build node slices for rendering
    const resultSlices: NodeSlice[] = []
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    for (const id of bfsOrder) {
      const n = nodeMap.get(id)
      if (!n) continue
      const d = depthMap.get(id) ?? 0
      const s = nodeSlice.get(id) ?? { left: 0, right: width }
      resultSlices.push({ id, type: n.type, depth: d, left: s.left, right: s.right, y: yPositions[d] })
    }

    // Build bands: for each node, divide its slice among outgoing links
    const tgtCursor = new Map<string, number>() // running x cursor per target node
    const resultBands: Band[] = []

    // Process links grouped by source, in BFS order
    for (const srcId of bfsOrder) {
      const srcSlice = nodeSlice.get(srcId)
      if (!srcSlice) continue
      const nodeLinks = outLinks.get(srcId) ?? []
      if (!nodeLinks.length) continue

      const srcDepth = depthMap.get(srcId) ?? 0
      const srcY = yPositions[srcDepth] + barH / 2

      const totalOut = nodeLinks.reduce((s, l) => s + Math.max(l.value, 0.5), 0)
      let sCur = srcSlice.left

      for (let li = 0; li < nodeLinks.length; li++) {
        const l = nodeLinks[li]
        const val = Math.max(l.value, 0.5)

        // Source band slice with gap
        const sLeft = sCur + (li > 0 ? bandGap / 2 : 0)
        const rawRight = sCur + (val / totalOut) * (srcSlice.right - srcSlice.left)
        const sRight = rawRight - (li < nodeLinks.length - 1 ? bandGap / 2 : 0)
        sCur = rawRight

        // Target band slice with gap
        const tgtSlice = nodeSlice.get(l.target)
        if (!tgtSlice) continue
        const tgtDepth = depthMap.get(l.target) ?? 0
        const tgtY = yPositions[tgtDepth] - barH / 2

        const tCurStart = tgtCursor.get(l.target) ?? tgtSlice.left
        const totalIn = (inLinks.get(l.target) ?? []).reduce((s, il) => s + Math.max(il.value, 0.5), 0)
        const inLinksForTarget = inLinks.get(l.target) ?? []
        const tIdx = inLinksForTarget.indexOf(l)
        const tWidth = (val / totalIn) * (tgtSlice.right - tgtSlice.left)
        const tLeft = tCurStart + (tIdx > 0 ? bandGap / 2 : 0)
        const tRight = tCurStart + tWidth - (tIdx < inLinksForTarget.length - 1 ? bandGap / 2 : 0)
        tgtCursor.set(l.target, tCurStart + tWidth)

        resultBands.push({
          choiceId: l.choice_id,
          srcLeft: Math.max(sLeft, 0), srcRight: Math.min(sRight, width), srcY,
          tgtLeft: Math.max(tLeft, 0), tgtRight: Math.min(tRight, width), tgtY,
        })
      }
    }

    const rects = resultSlices.map(s => ({
      left: s.left,
      right: s.right,
      y: s.y,
    }))

    return { bands: resultBands, nodeRects: rects }
  }, [nodes, links, width, height])

  const bandPath = (b: Band) => {
    const dy = b.tgtY - b.srcY
    // Control points stay vertical for 80% of the distance before curving
    const c1y = b.srcY + dy * 0.8
    const c2y = b.srcY + dy * 0.2
    return [
      `M${b.srcLeft},${b.srcY}`,
      `C${b.srcLeft},${c1y} ${b.tgtLeft},${c2y} ${b.tgtLeft},${b.tgtY}`,
      `L${b.tgtRight},${b.tgtY}`,
      `C${b.tgtRight},${c2y} ${b.srcRight},${c1y} ${b.srcRight},${b.srcY}`,
      'Z',
    ].join(' ')
  }

  return (
    <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
      {/* Individual node bars */}
      <g>
        {(nodeRects ?? []).map((r, i) => (
          <rect
            key={i}
            x={r.left} y={r.y - barH / 2}
            width={r.right - r.left} height={barH}
            fill="currentColor"
            opacity={0.12}
            rx={3}
          />
        ))}
      </g>
      {/* Bands */}
      <g>
        {bands.map((b, i) => {
          const highlighted = highlightChoiceIds?.has(b.choiceId)
          return (
            <path
              key={i}
              d={bandPath(b)}
              fill="currentColor"
              fillOpacity={highlighted ? 0.4 : 0.1}
              stroke="none"
            />
          )
        })}
      </g>
    </svg>
  )
}
