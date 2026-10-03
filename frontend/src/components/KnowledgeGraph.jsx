import EChart from './EChart'

/** 知识图谱可视化（知识点 → 能力 → 课程目标） */
export default function KnowledgeGraph({ graph, mastery, height = 500 }) {
  if (!graph || !graph.nodes || !graph.nodes.length) return <div className="empty">暂无知识图谱</div>
  const levelColor = { 1: '#1e6fff', 2: '#16a34a', 3: '#f59e0b' }
  const nodeSize = { 1: 42, 2: 32, 3: 24 }
  const m = mastery || {}
  const nodes = graph.nodes.map((n) => {
    const masteryVal = m[n.id] != null ? m[n.id] : null
    return {
      id: n.id,
      name: n.name,
      symbolSize: nodeSize[n.level] || 28,
      category: n.level,
      itemStyle: {
        color: masteryVal != null ? (masteryVal >= 70 ? '#16a34a' : masteryVal >= 60 ? '#f59e0b' : '#dc2626') : levelColor[n.level],
        borderColor: '#fff', borderWidth: 1.5,
      },
      label: { show: true, fontSize: n.level === 1 ? 13 : 11, color: '#374151', formatter: masteryVal != null ? `${n.name}\n${masteryVal}%` : n.name },
    }
  })
  const edges = (graph.edges || []).map((e, i) => ({
    source: e.source, target: e.target,
    lineStyle: { width: 1 + (e.strength || 0.5) * 2, color: '#9ca3af', curveness: 0.1, type: e.type === 'prerequisite' ? 'solid' : 'dashed' },
  }))
  const option = {
    tooltip: {
      formatter: (p) => {
        if (p.dataType === 'node') {
          const mm = m[p.data.id] != null ? `掌握度：${m[p.data.id]}%` : '未直接评估'
          return `<b>${p.data.name}</b><br/>${mm}`
        }
        return ''
      },
    },
    legend: [{ data: ['章', '节', '知识点'], top: 0, textStyle: { fontSize: 11 } }],
    series: [{
      type: 'graph', layout: 'force', data: nodes, links: edges, roam: true,
      categories: [{ name: '章' }, { name: '节' }, { name: '知识点' }],
      force: { repulsion: 220, edgeLength: [60, 140], gravity: 0.08 },
      emphasis: { focus: 'adjacency', label: { show: true } },
      lineStyle: { color: '#9ca3af' },
    }],
  }
  return <EChart option={option} height={height} />
}
