import EChart from './EChart'

/** 能力画像雷达图（多维度，按类别配色/分组） */
export default function RadarChart({ dimensions, height = 400, title = '能力画像雷达图' }) {
  if (!dimensions || !dimensions.length) return <div className="empty">暂无能力数据</div>
  const max = 16 // 单组最多展示维度
  const groups = []
  for (let i = 0; i < dimensions.length; i += max) groups.push(dimensions.slice(i, i + max))

  return (
    <div>
      {groups.map((g, gi) => {
        const names = g.map((d) => d.name)
        const values = g.map((d) => d.score)
        const option = {
          tooltip: {
            trigger: 'item',
            formatter: (p) => {
              const d = g[p.dataIndex]
              return `${d.name}<br/>得分：<b>${d.score}</b>（${d.level}）<br/>${d.inferred ? '（知识图谱推断）' : '（直接评估）'}`
            },
          },
          legend: { top: 0, textStyle: { fontSize: 11 } },
          radar: {
            indicator: names.map((n) => ({ name: n, max: 100 })),
            radius: '62%',
            center: ['50%', '55%'],
            splitArea: { areaStyle: { color: ['rgba(30,111,255,0.02)', 'rgba(30,111,255,0.06)'] } },
            axisName: { fontSize: 10, color: '#6b7280' },
          },
          series: [{
            type: 'radar',
            data: [{ value: values, name: title, areaStyle: { color: 'rgba(30,111,255,0.25)' }, lineStyle: { color: '#1e6fff', width: 2 }, itemStyle: { color: '#1e6fff' } }],
          }],
        }
        return <EChart key={gi} option={option} height={height} />
      })}
    </div>
  )
}
