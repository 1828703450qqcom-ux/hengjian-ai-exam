import { useEffect, useState } from 'react'
import api from '../api'
import RadarChart from '../components/RadarChart'
import KnowledgeGraph from '../components/KnowledgeGraph'
import EChart from '../components/EChart'
import { PageHeader, Tag, Loading, Empty, Progress } from '../components/ui'

const LEVEL_COLOR = { 优秀: 'green', 良好: 'blue', 合格: 'orange', 待提高: 'red' }
const CAT_COLOR = { 通用素养: '#8b5cf6', 学科能力: '#0ea5e9', 语言能力: '#1e6fff', 思政素养: '#f59e0b', 认知层级: '#16a34a' }

export default function CapabilityPortrait() {
  const [portrait, setPortrait] = useState(null)
  const [graph, setGraph] = useState(null)
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/capability/my').then((d) => {
      if (d.exists) {
        setPortrait(d)
        setCourseId(d.course.id)
        api.get('/capability/graph', { params: { course_id: d.course.id } }).then((g) => {
          const mastery = {}
          d.knowledge_points.forEach((k) => { mastery[k.kp_id] = k.mastery })
          setGraph({ ...g, mastery })
        })
      }
    }).finally(() => setLoading(false))
    api.get('/system/courses').then((d) => setCourses(d.items)).catch(() => {})
  }, [])

  const loadCourse = async (cid) => {
    setCourseId(cid)
    if (!cid) return
    const g = await api.get('/capability/graph', { params: { course_id: cid } })
    setGraph({ ...g, mastery: {} })
  }

  if (loading) return <Loading text="生成能力画像..." />
  if (!portrait) return (
    <div>
      <PageHeader title="我的能力画像" desc="知识图谱 · 能力诊断 · 个性化学习建议" />
      <Empty icon="🧭" title="暂无能力画像" desc="完成一场考试后，系统将自动生成 ≥50 维能力画像与个性化学习建议" />
    </div>
  )

  const dims = portrait.dimensions
  const catCount = {}
  dims.forEach((d) => { catCount[d.category] = (catCount[d.category] || 0) + 1 })
  const radarDims = dims.filter((d) => !d.inferred || d.score >= 0)
  const directCount = dims.filter((d) => !d.inferred).length
  const catPie = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#64748b' } },
    series: [{
      type: 'pie', radius: ['42%', '68%'],
      data: Object.entries(catCount).map(([k, v]) => ({ name: `${k}(${v}维)`, value: v, itemStyle: { color: CAT_COLOR[k] } })),
      label: { fontSize: 11 }, labelLine: { length: 8 },
    }],
  }
  const growthOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 36, right: 16, top: 24, bottom: 30 },
    xAxis: { type: 'category', data: (portrait.growth_history || []).map(x => x.date ? x.date.slice(5, 10) : `#${x.id}`), boundaryGap: false, axisLine: { lineStyle: { color: '#dce6f2' } }, axisLabel: { color: '#7c8fae' } },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#edf2f7' } }, axisLabel: { color: '#7c8fae' } },
    series: [{ type: 'line', smooth: true, data: (portrait.growth_history || []).map(x => x.score), symbolSize: 7, itemStyle: { color: '#287cf0' }, lineStyle: { width: 3 }, areaStyle: { color: 'rgba(40,124,240,.12)' } }],
  }
  const levelColor = LEVEL_COLOR[portrait.overall_level] || 'blue'
  const levelVal = portrait.overall_level
  const strongDims = dims.filter((d) => ['优秀', '良好'].includes(d.level) && !d.inferred).slice(0, 8).map((d) => d.name)
  const weakDims = dims.filter((d) => d.level === '待提高').slice(0, 6).map((d) => d.name)

  return (
    <div>
      <PageHeader title="我的能力画像" desc={`${portrait.course?.name || ''} · 基于考试得分的知识图谱能力诊断`} crumb={['考生中心', '能力画像']} />

      <div className="portrait-hero mb16">
        <div className="level-card">
          <div className="small" style={{ color: 'rgba(219,231,255,0.7)', letterSpacing: 2 }}>综合能力等级</div>
          <div className="lv">{levelVal}</div>
          <div className="lv-sub">画像匹配度 {((portrait.match_score || 0) * 100).toFixed(1)}%（目标 ≥88%）</div>
          <div className="bar mt16"><i style={{ width: `${Math.min((portrait.match_score || 0) * 100, 100)}%` }} /></div>
          <div className="mt16" style={{ fontSize: 12, color: 'rgba(219,231,255,0.8)' }}>全量 {portrait.dim_count} 维 · 本场直接评估 {directCount} 维</div>
        </div>
        <div className="card">
          <div className="card-title"><span>维度类别分布（共 {dims.length} 维）</span></div>
          <EChart option={catPie} height={240} />
        </div>
      </div>

      <div className="portrait-data-row mb16">
        <div className="card portrait-growth"><div className="card-title"><span>能力成长轨迹</span><Tag color="blue">最近 {portrait.growth_history?.length || 0} 次画像</Tag></div>{portrait.growth_history?.length ? <EChart option={growthOption} height={220}/> : <div className="small muted">完成更多考试后将形成连续成长曲线</div>}</div>
        <div className="card portrait-evidence"><div className="card-title"><span>画像数据可信度</span><Tag color="green" dot>{portrait.data_version || 'portrait-v2'}</Tag></div><div className="evidence-score"><strong>{Math.round((portrait.evidence_reliability || 0) * 100)}</strong><span>%<small>综合可信度</small></span></div><div className="evidence-meta"><span><b>{portrait.evidence_count || 0}</b> 条画像证据</span><span><b>{directCount}</b> 维直接评估</span><span><b>{dims.length-directCount}</b> 维图谱推断</span></div><div className="bar mt16"><i className="green" style={{width:`${Math.round((portrait.evidence_reliability || 0)*100)}%`}}/></div></div>
      </div>

      {portrait.categories?.length > 0 && <div className="category-strip mb16">{portrait.categories.map(c=><div key={c.name}><span>{c.name}</span><b>{c.score}</b><small>{c.direct_count}/{c.dimension_count} 维有直接证据</small><i><em style={{width:`${c.score}%`}}/></i></div>)}</div>}

      <div className="card mb16">
        <div className="card-title"><span>画像总览</span><Tag color={levelColor} dot>{levelVal}</Tag></div>
        <div className="small muted" style={{ lineHeight: 2 }}>{portrait.summary}</div>
        {strongDims.length > 0 && (
          <div className="mt8" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="small muted">优势能力：</span>
            {strongDims.map((s) => <Tag key={s} color="green" dot>{s}</Tag>)}
          </div>
        )}
        {weakDims.length > 0 && (
          <div className="mt8" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="small muted">待提升：</span>
            {weakDims.map((s) => <Tag key={s} color="red" dot>{s}</Tag>)}
          </div>
        )}
      </div>

      {portrait.objectives && portrait.objectives.length > 0 && (
        <div className="card mb16">
          <div className="card-title"><span>课程目标达成度（OBE 成果导向）</span><Tag color="cyan" dot>过程数据</Tag></div>
          <div className="grid grid-3">
            {portrait.objectives.map((o) => {
              const pct = Math.round((o.achievement || 0) * 100)
              return (
                <div className="stat" key={o.code}>
                  <div className="label">{o.code} · {o.name}</div>
                  <div className="value" style={{ fontSize: 24 }}>{pct}%</div>
                  <div className="bar mt8"><i className={o.achievement >= 0.7 ? 'green' : o.achievement >= 0.6 ? 'orange' : 'red'} style={{ width: `${pct}%` }} /></div>
                  <div className="small mt8 muted">{o.achievement >= 0.7 ? '达成' : o.achievement >= 0.6 ? '基本达成' : '待加强'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card mb16">
        <div className="card-title"><span>≥50 维能力画像雷达</span><Tag color="purple">{directCount} 维直接评估 + 知识图谱推断</Tag></div>
        <RadarChart dimensions={radarDims} height={460} />
      </div>

      <div className="card mb16">
        <div className="card-title"><span>能力维度明细</span><Tag color="gray">{dims.length} 维</Tag></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>维度</th><th>类别</th><th className="num">得分</th><th>等级</th><th>来源</th></tr></thead>
            <tbody>
              {dims.map((d) => (
                <tr key={d.code}>
                  <td><b>{d.name}</b></td>
                  <td><Tag color="gray">{d.category}</Tag></td>
                  <td className="num"><b>{d.score}</b></td>
                  <td><Tag color={LEVEL_COLOR[d.level] || 'gray'} dot>{d.level}</Tag></td>
                  <td className="small muted">{d.inferred ? '知识图谱推断' : `直接评估(${d.question_count}题)`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb16">
        <div className="card-title">
          <span>知识图谱 · 知识点掌握度</span>
          <div className="flex">
            <select className="select" style={{ width: 220 }} value={courseId} onChange={(e) => loadCourse(Number(e.target.value))}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <KnowledgeGraph graph={graph} mastery={graph?.mastery || {}} height={520} />
        <div className="small muted mt8" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span><span className="tag green" dot>掌握良好 ≥70</span></span>
          <span><span className="tag orange" dot>基本掌握 60-70</span></span>
          <span><span className="tag red" dot>待提高 &lt;60</span></span>
          <span className="muted">连线 = 前置/关联关系（知识图谱传播推断）</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span>个性化学习指导建议</span><Tag color="blue" dot>基于薄弱能力生成</Tag></div>
        {(portrait.learning_advice || []).map((a, i) => (
          <div className="advice-item" key={i}>
            <b>{a.dimension}</b> <span className="muted small">（当前 {a.score} 分）</span>
            <div className="small mt8" style={{ lineHeight: 2 }}>{a.advice.map((t, j) => <div key={j}>· {t}</div>)}</div>
          </div>
        ))}
        {(!portrait.learning_advice || portrait.learning_advice.length === 0) && <Empty icon="🎉" title="暂无待提升项" desc="各能力维度均表现良好" />}
      </div>
    </div>
  )
}
