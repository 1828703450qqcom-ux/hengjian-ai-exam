import { useState, useEffect, useMemo } from 'react'
import { PageHeader, Tag, Loading, toast } from '../components/ui'
import EChart from '../components/EChart'

// 演示数据
const DEMO_DATA = {
  courses: [
    { id: 1, name: '大学英语（二）', credit: 4, hours: 64 },
    { id: 2, name: '高等数学', credit: 5, hours: 80 },
    { id: 3, name: '计算机基础', credit: 3, hours: 48 },
  ],
  course_objectives: [
    {
      id: 1, code: '目标1', name: '语言知识与应用能力',
      desc: '掌握英语词汇、语法和语用知识，能在实际语境中准确运用',
      weight: 25, target: 0.75,
      knowledge_points: ['词汇辨析', '语法结构', '语用知识'],
      achievement: 0.78,
      exam_contribution: { '期末考试': 40, '期中考试': 30, '平时作业': 30 },
    },
    {
      id: 2, code: '目标2', name: '阅读理解与信息获取能力',
      desc: '能读懂不同体裁的英语文章，获取关键信息，理解作者意图',
      weight: 30, target: 0.75,
      knowledge_points: ['细节理解', '推理判断', '主旨大意', '词义猜测'],
      achievement: 0.72,
      exam_contribution: { '期末考试': 50, '期中考试': 30, '平时作业': 20 },
    },
    {
      id: 3, code: '目标3', name: '翻译与写作表达能力',
      desc: '能进行英汉互译，能撰写不同体裁的英语作文，表达清晰准确',
      weight: 25, target: 0.70,
      knowledge_points: ['翻译技巧', '写作结构', '语言表达'],
      achievement: 0.68,
      exam_contribution: { '期末考试': 45, '期中考试': 25, '平时作业': 30 },
    },
    {
      id: 4, code: '目标4', name: '跨文化交际与思辨能力',
      desc: '了解中西文化差异，能进行跨文化交际，具备批判性思维能力',
      weight: 20, target: 0.70,
      knowledge_points: ['文化差异', '跨文化交际', '批判性思维'],
      achievement: 0.75,
      exam_contribution: { '期末考试': 30, '期中考试': 30, '平时作业': 40 },
    },
  ],
  student_achievements: [
    { rank: 1, name: '张三', student_no: '202401001', obj1: 0.92, obj2: 0.88, obj3: 0.85, obj4: 0.90, overall: 0.89 },
    { rank: 2, name: '李四', student_no: '202401002', obj1: 0.88, obj2: 0.85, obj3: 0.82, obj4: 0.86, overall: 0.85 },
    { rank: 3, name: '王五', student_no: '202401003', obj1: 0.85, obj2: 0.80, obj3: 0.78, obj4: 0.82, overall: 0.81 },
    { rank: 4, name: '赵六', student_no: '202401004', obj1: 0.78, obj2: 0.72, obj3: 0.68, obj4: 0.75, overall: 0.73 },
    { rank: 5, name: '钱七', student_no: '202401005', obj1: 0.72, obj2: 0.68, obj3: 0.62, obj4: 0.70, overall: 0.68 },
  ],
  trend_data: [
    { semester: '2024秋', obj1: 0.72, obj2: 0.68, obj3: 0.62, obj4: 0.70, overall: 0.68 },
    { semester: '2025春', obj1: 0.75, obj2: 0.70, obj3: 0.65, obj4: 0.72, overall: 0.71 },
    { semester: '2025秋', obj1: 0.78, obj2: 0.72, obj3: 0.68, obj4: 0.75, overall: 0.73 },
  ],
}

export default function CourseObjectiveAnalysis() {
  const [data, setData] = useState(DEMO_DATA)
  const [loading, setLoading] = useState(true)
  const [activeCourse, setActiveCourse] = useState(1)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    setTimeout(() => setLoading(false), 500)
  }, [])

  const tabs = [
    { key: 'overview', label: '📊 达成度概览' },
    { key: 'detail', label: '📋 目标详情' },
    { key: 'student', label: '👥 学生达成度' },
    { key: 'trend', label: '📈 历史趋势' },
  ]

  // 课程目标达成度雷达图
  const radarOption = useMemo(() => ({
    tooltip: { backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { data: ['实际达成度', '目标值'], top: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    radar: {
      indicator: data.course_objectives.map(o => ({ name: o.code, max: 1 })),
      shape: 'polygon', splitNumber: 5,
      axisName: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
      splitArea: { areaStyle: { color: ['rgba(59,130,246,0.02)', 'rgba(59,130,246,0.05)'] } },
    },
    series: [{
      type: 'radar',
      data: [
        { value: data.course_objectives.map(o => o.achievement), name: '实际达成度',
          areaStyle: { color: 'rgba(59,130,246,0.2)' }, lineStyle: { color: '#3b82f6', width: 2 }, itemStyle: { color: '#3b82f6' } },
        { value: data.course_objectives.map(o => o.target), name: '目标值',
          areaStyle: { color: 'rgba(239,68,68,0.1)' }, lineStyle: { color: '#ef4444', width: 2, type: 'dashed' }, itemStyle: { color: '#ef4444' } },
      ]
    }]
  }), [data])

  // 达成度柱状图
  const barOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { data: ['实际达成度', '目标值'], top: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    grid: { left: 50, right: 20, top: 40, bottom: 60 },
    xAxis: { type: 'category', data: data.course_objectives.map(o => o.code), axisLabel: { color: '#6b7280', fontSize: 11, rotate: 0 } },
    yAxis: { type: 'value', min: 0, max: 1, axisLabel: { color: '#6b7280', fontSize: 11, formatter: v => (v * 100).toFixed(0) + '%' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [
      { name: '实际达成度', type: 'bar', data: data.course_objectives.map(o => ({
        value: o.achievement,
        itemStyle: { color: o.achievement >= o.target ? '#10b981' : '#f59e0b', borderRadius: [6, 6, 0, 0] }
      })), label: { show: true, position: 'top', fontSize: 11, color: '#6b7280', formatter: p => (p.value * 100).toFixed(0) + '%' }, barWidth: '35%' },
      { name: '目标值', type: 'line', data: data.course_objectives.map(o => o.target), itemStyle: { color: '#ef4444' }, lineStyle: { type: 'dashed', width: 2 } },
    ]
  }), [data])

  // 历史趋势图
  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { data: ['目标1', '目标2', '目标3', '目标4', '综合达成度'], top: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: data.trend_data.map(d => d.semester), axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', min: 0.5, max: 1, axisLabel: { color: '#6b7280', fontSize: 11, formatter: v => (v * 100).toFixed(0) + '%' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [
      { name: '目标1', type: 'line', smooth: true, data: data.trend_data.map(d => d.obj1), itemStyle: { color: '#3b82f6' } },
      { name: '目标2', type: 'line', smooth: true, data: data.trend_data.map(d => d.obj2), itemStyle: { color: '#10b981' } },
      { name: '目标3', type: 'line', smooth: true, data: data.trend_data.map(d => d.obj3), itemStyle: { color: '#f59e0b' } },
      { name: '目标4', type: 'line', smooth: true, data: data.trend_data.map(d => d.obj4), itemStyle: { color: '#8b5cf6' } },
      { name: '综合达成度', type: 'line', smooth: true, data: data.trend_data.map(d => d.overall), itemStyle: { color: '#ef4444' }, lineStyle: { width: 3 } },
    ]
  }), [data])

  // 综合达成度计算
  const overallAchievement = useMemo(() => {
    const total = data.course_objectives.reduce((sum, o) => sum + o.achievement * o.weight, 0)
    return total / 100
  }, [data])

  const achievedCount = data.course_objectives.filter(o => o.achievement >= o.target).length

  if (loading) return <Loading text="加载课程目标达成度分析..." />

  const currentCourse = data.courses.find(c => c.id === activeCourse)

  return (
    <div>
      <PageHeader
        title="🎯 课程目标达成度分析"
        subtitle="OBE成果导向教育 · 课程目标达成度计算与分析"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" value={activeCourse} onChange={e => setActiveCourse(Number(e.target.value))} style={{ width: 200 }}>
              {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn primary" onClick={() => toast.success('报告已导出')}>📥 导出报告</button>
          </div>
        }
      />

      {/* 概览统计卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>📚 课程学分</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{currentCourse?.credit}<span style={{ fontSize: 14, color: '#6b7280' }}>学分</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>🎯 综合达成度</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{(overallAchievement * 100).toFixed(1)}%</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>✅ 达成目标数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{achievedCount}<span style={{ fontSize: 14, color: '#6b7280' }}>/{data.course_objectives.length}</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>⚠️ 待改进目标</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>{data.course_objectives.length - achievedCount}<span style={{ fontSize: 14, color: '#6b7280' }}>个</span></div>
        </div>
      </div>

      {/* Tab切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? '#3b82f6' : '#6b7280',
              borderBottom: activeTab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 达成度概览Tab */}
      {activeTab === 'overview' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>🎯 课程目标达成度雷达图</span></div>
            <EChart option={radarOption} height={320} />
          </div>
          <div className="card">
            <div className="card-title"><span>📊 达成度对比（实际vs目标）</span></div>
            <EChart option={barOption} height={320} />
          </div>
        </div>
      )}

      {/* 目标详情Tab */}
      {activeTab === 'detail' && (
        <div className="card">
          <div className="card-title"><span>📋 课程目标详情</span><Tag color="gray">{data.course_objectives.length}个目标</Tag></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.course_objectives.map(o => (
              <div key={o.id} style={{ padding: '16px 18px', background: '#f8fafc', borderRadius: 12, border: `1px solid ${o.achievement >= o.target ? '#bbf7d0' : '#fde68a'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <Tag color="blue">{o.code}</Tag>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>{o.name}</span>
                      <Tag color={o.achievement >= o.target ? 'green' : 'orange'}>{o.achievement >= o.target ? '已达成' : '待改进'}</Tag>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{o.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 20 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>权重</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{o.weight}%</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>达成度</span>
                  <div style={{ flex: 1, height: 10, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${o.achievement * 100}%`, height: '100%', background: o.achievement >= o.target ? '#10b981' : '#f59e0b', borderRadius: 5, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: o.achievement >= o.target ? '#10b981' : '#f59e0b', minWidth: 50, textAlign: 'right' }}>{(o.achievement * 100).toFixed(0)}%</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>目标 {(o.target * 100).toFixed(0)}%</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>支撑知识点：</span>
                  {o.knowledge_points.map(kp => (
                    <Tag key={kp} color="purple">{kp}</Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 学生达成度Tab */}
      {activeTab === 'student' && (
        <div className="card">
          <div className="card-title"><span>👥 学生课程目标达成度</span><Tag color="gray">Top 5</Tag></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>排名</th><th>姓名</th><th>学号</th><th>目标1</th><th>目标2</th><th>目标3</th><th>目标4</th><th>综合达成度</th><th>评价</th></tr></thead>
              <tbody>
                {data.student_achievements.map(s => (
                  <tr key={s.student_no}>
                    <td>
                      <span style={{
                        display: 'inline-flex', width: 24, height: 24, borderRadius: '50%',
                        background: s.rank === 1 ? '#fbbf24' : s.rank === 2 ? '#9ca3af' : s.rank === 3 ? '#d97706' : '#e5e7eb',
                        color: s.rank <= 3 ? '#fff' : '#6b7280', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                      }}>{s.rank}</span>
                    </td>
                    <td><b>{s.name}</b></td>
                    <td className="small muted">{s.student_no}</td>
                    <td className="num" style={{ color: s.obj1 >= 0.75 ? '#10b981' : s.obj1 >= 0.6 ? '#f59e0b' : '#ef4444' }}>{(s.obj1 * 100).toFixed(0)}%</td>
                    <td className="num" style={{ color: s.obj2 >= 0.75 ? '#10b981' : s.obj2 >= 0.6 ? '#f59e0b' : '#ef4444' }}>{(s.obj2 * 100).toFixed(0)}%</td>
                    <td className="num" style={{ color: s.obj3 >= 0.70 ? '#10b981' : s.obj3 >= 0.6 ? '#f59e0b' : '#ef4444' }}>{(s.obj3 * 100).toFixed(0)}%</td>
                    <td className="num" style={{ color: s.obj4 >= 0.70 ? '#10b981' : s.obj4 >= 0.6 ? '#f59e0b' : '#ef4444' }}>{(s.obj4 * 100).toFixed(0)}%</td>
                    <td className="num" style={{ fontWeight: 700, color: s.overall >= 0.75 ? '#10b981' : s.overall >= 0.6 ? '#f59e0b' : '#ef4444' }}>{(s.overall * 100).toFixed(0)}%</td>
                    <td><Tag color={s.overall >= 0.8 ? 'green' : s.overall >= 0.7 ? 'blue' : 'orange'}>{s.overall >= 0.8 ? '优秀' : s.overall >= 0.7 ? '良好' : '待提升'}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 历史趋势Tab */}
      {activeTab === 'trend' && (
        <div className="card">
          <div className="card-title"><span>📈 课程目标达成度历史趋势</span><Tag color="blue">{data.trend_data.length}学期</Tag></div>
          <EChart option={trendOption} height={400} />
        </div>
      )}

      {/* 教学改进建议 */}
      <div className="card mt16" style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1px solid #bae6fd' }}>
        <div className="card-title"><span>💡 教学改进建议（基于达成度分析）</span><Tag color="blue">AI智能分析</Tag></div>
        <div style={{ fontSize: 14, color: '#0c4a6e', lineHeight: 1.8 }}>
          <p>1. <b>目标3（翻译与写作表达能力）</b>达成度最低（68%），低于目标值（70%），建议增加翻译和写作训练，每周布置1篇翻译练习和1篇作文。</p>
          <p>2. <b>目标2（阅读理解与信息获取能力）</b>达成度72%，接近目标值，建议加强推理判断题和主旨大意题的专项训练。</p>
          <p>3. <b>目标1和目标4</b>已达成目标，继续保持现有教学方法，可适当增加拓展性内容。</p>
          <p>4. 从历史趋势看，各目标达成度均呈上升趋势，教学改革效果良好，建议继续推进OBE教学模式。</p>
          <p>5. 学生个体差异较大，建议对达成度较低的学生进行针对性辅导，建立学习帮扶机制。</p>
        </div>
      </div>
    </div>
  )
}
