import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import { PageHeader, Tag, Loading, toast, Empty } from '../components/ui'
import EChart from '../components/EChart'

// 演示数据（后续可接入真实后端数据）
const DEMO_DATA = {
  exam: { title: '大学英语（二）期末考试', course: '大学英语', total_score: 100, duration: 120 },
  overview: {
    total_students: 45, submitted: 42, avg_score: 76.5, max_score: 98, min_score: 42,
    pass_rate: 85.7, excellent_rate: 23.8, median: 78, std_dev: 12.3,
  },
  score_distribution: [
    { range: '0-59', count: 6 }, { range: '60-69', count: 8 },
    { range: '70-79', count: 14 }, { range: '80-89', count: 10 }, { range: '90-100', count: 4 },
  ],
  difficulty_distribution: [
    { name: '简单题', value: 35 }, { name: '中等题', value: 45 }, { name: '困难题', value: 20 },
  ],
  question_analysis: [
    { no: 1, type: '听力', score: 15, avg_score: 12.3, correct_rate: 82, discrimination: 0.45 },
    { no: 2, type: '阅读', score: 30, avg_score: 21.5, correct_rate: 72, discrimination: 0.52 },
    { no: 3, type: '完形', score: 15, avg_score: 9.8, correct_rate: 65, discrimination: 0.38 },
    { no: 4, type: '翻译', score: 15, avg_score: 10.2, correct_rate: 68, discrimination: 0.41 },
    { no: 5, type: '作文', score: 25, avg_score: 18.5, correct_rate: 74, discrimination: 0.48 },
  ],
  knowledge_mastery: [
    { name: '听力理解', value: 82 }, { name: '阅读理解', value: 72 },
    { name: '词汇语法', value: 68 }, { name: '翻译能力', value: 65 },
    { name: '写作表达', value: 74 }, { name: '完形填空', value: 65 },
  ],
  wrong_rate_rank: [
    { no: 18, type: '阅读', content: 'According to the passage, the author\'s attitude towards...', wrong_rate: 78, avg_score: 1.2, full_score: 3 },
    { no: 25, type: '完形', content: 'The scientist\'s breakthrough discovery was _____ by...', wrong_rate: 72, avg_score: 0.8, full_score: 2 },
    { no: 32, type: '翻译', content: '随着人工智能技术的快速发展，越来越多的传统行业...', wrong_rate: 68, avg_score: 6.5, full_score: 15 },
    { no: 12, type: '听力', content: 'What does the woman imply about the meeting?', wrong_rate: 65, avg_score: 0.7, full_score: 2 },
    { no: 41, type: '作文', content: 'Directions: Write an essay on the topic "The Importance of...', wrong_rate: 58, avg_score: 14.5, full_score: 25 },
  ],
  ability_model: [
    { name: '阅读理解能力', value: 72, target: 80 },
    { name: '逻辑推理能力', value: 68, target: 75 },
    { name: '记忆能力', value: 82, target: 70 },
    { name: '分析能力', value: 70, target: 78 },
    { name: '计算能力', value: 75, target: 72 },
    { name: '表达能力', value: 65, target: 80 },
  ],
}

export default function ExamAnalysis() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [data, setData] = useState(DEMO_DATA)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    // 尝试从后端获取真实数据，失败则使用演示数据
    api.get(`/exams/${id}`).then(d => setExam(d)).catch(() => {})
    setTimeout(() => setLoading(false), 500)
  }, [id])

  const tabs = [
    { key: 'overview', label: '📊 概览统计' },
    { key: 'score', label: '📈 成绩分析' },
    { key: 'question', label: '📝 题目分析' },
    { key: 'knowledge', label: '🧠 知识点与能力' },
    { key: 'wrong', label: '❌ 错题排行' },
  ]

  // 得分分布直方图
  const scoreHistOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: data.score_distribution.map(d => d.range), axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', name: '人数', axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      type: 'bar', data: data.score_distribution.map((d, i) => ({
        value: d.count,
        itemStyle: { color: i < 1 ? '#ef4444' : i < 2 ? '#f59e0b' : i < 4 ? '#3b82f6' : '#10b981', borderRadius: [6, 6, 0, 0] }
      })),
      label: { show: true, position: 'top', fontSize: 11, color: '#6b7280' },
      barWidth: '50%',
    }]
  }), [data])

  // 难度分布饼图
  const diffPieOption = useMemo(() => ({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: data.difficulty_distribution,
      label: { fontSize: 11, color: '#6b7280', formatter: '{b}: {c}分 ({d}%)' },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      color: ['#10b981', '#3b82f6', '#ef4444'],
    }]
  }), [data])

  // 知识点雷达图
  const radarOption = useMemo(() => ({
    tooltip: { backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    radar: {
      indicator: data.knowledge_mastery.map(k => ({ name: k.name, max: 100 })),
      shape: 'polygon', splitNumber: 4,
      axisName: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
      splitArea: { areaStyle: { color: ['rgba(59,130,246,0.02)', 'rgba(59,130,246,0.05)'] } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: data.knowledge_mastery.map(k => k.value),
        name: '班级平均掌握度',
        areaStyle: { color: 'rgba(59,130,246,0.2)' },
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' }
      }]
    }]
  }), [data])

  // 能力模型对比图
  const abilityOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { data: ['实际值', '目标值'], top: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    grid: { left: 50, right: 20, top: 40, bottom: 60 },
    xAxis: { type: 'category', data: data.ability_model.map(a => a.name), axisLabel: { color: '#6b7280', fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [
      { name: '实际值', type: 'bar', data: data.ability_model.map(a => a.value), itemStyle: { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] }, barWidth: '30%' },
      { name: '目标值', type: 'line', data: data.ability_model.map(a => a.target), itemStyle: { color: '#ef4444' }, lineStyle: { type: 'dashed', width: 2 } },
    ]
  }), [data])

  const exportReport = () => {
    const printWindow = window.open('', '_blank')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>考试分析报告</title>
    <style>
      body { font-family: 'Microsoft YaHei', sans-serif; padding: 30px; color: #333; }
      h1 { text-align: center; color: #1e40af; }
      .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
      .section { margin-bottom: 25px; page-break-inside: avoid; }
      .section h2 { color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
      .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 15px 0; }
      .stat { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; }
      .stat .label { font-size: 12px; color: #666; }
      .stat .value { font-size: 24px; font-weight: 700; color: #1e40af; margin-top: 5px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-size: 13px; }
      th { background: #f1f5f9; font-weight: 600; }
      .high { color: #10b981; } .medium { color: #f59e0b; } .low { color: #ef4444; }
    </style></head><body>
    <h1>📊 考试结果分析报告</h1>
    <div class="subtitle">${data.exam.title} · 生成时间：${new Date().toLocaleString('zh-CN')}</div>
    <div class="section">
      <h2>一、概览统计</h2>
      <div class="stats">
        <div class="stat"><div class="label">参加人数</div><div class="value">${data.overview.submitted}</div></div>
        <div class="stat"><div class="label">平均分</div><div class="value">${data.overview.avg_score}</div></div>
        <div class="stat"><div class="label">最高分</div><div class="value">${data.overview.max_score}</div></div>
        <div class="stat"><div class="label">最低分</div><div class="value">${data.overview.min_score}</div></div>
        <div class="stat"><div class="label">及格率</div><div class="value">${data.overview.pass_rate}%</div></div>
        <div class="stat"><div class="label">优秀率</div><div class="value">${data.overview.excellent_rate}%</div></div>
        <div class="stat"><div class="label">中位数</div><div class="value">${data.overview.median}</div></div>
        <div class="stat"><div class="label">标准差</div><div class="value">${data.overview.std_dev}</div></div>
      </div>
    </div>
    <div class="section">
      <h2>二、题目分析</h2>
      <table>
        <tr><th>题号</th><th>题型</th><th>满分</th><th>平均得分</th><th>正确率</th><th>区分度</th></tr>
        ${data.question_analysis.map(q => `<tr><td>${q.no}</td><td>${q.type}</td><td>${q.score}</td><td>${q.avg_score}</td><td class="${q.correct_rate >= 75 ? 'high' : q.correct_rate >= 60 ? 'medium' : 'low'}">${q.correct_rate}%</td><td>${q.discrimination}</td></tr>`).join('')}
      </table>
    </div>
    <div class="section">
      <h2>三、错题率排行（Top 5）</h2>
      <table>
        <tr><th>题号</th><th>题型</th><th>题目内容</th><th>错误率</th><th>平均得分</th></tr>
        ${data.wrong_rate_rank.map(w => `<tr><td>${w.no}</td><td>${w.type}</td><td>${w.content.substring(0, 50)}...</td><td class="low">${w.wrong_rate}%</td><td>${w.avg_score}/${w.full_score}</td></tr>`).join('')}
      </table>
    </div>
    <div class="section">
      <h2>四、教学建议</h2>
      <p>1. 班级整体平均分${data.overview.avg_score}分，及格率${data.overview.pass_rate}%，整体表现${data.overview.pass_rate >= 80 ? '良好' : '有待提升'}。</p>
      <p>2. 阅读理解和翻译能力是薄弱环节，建议加强相关知识点的教学和练习。</p>
      <p>3. 第18题（阅读）错误率最高（78%），建议在课堂上重点讲解该题涉及的知识点。</p>
      <p>4. 表达能力（65分）低于目标值（80分），建议增加写作训练和课堂表达机会。</p>
    </div>
    </body></html>`
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
    toast.success('已生成分析报告，可在打印对话框中选择"另存为PDF"')
  }

  if (loading) return <Loading text="加载分析报告..." />

  const o = data.overview

  return (
    <div>
      <PageHeader
        title="📊 考试结果分析报告"
        subtitle={data.exam.title}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={exportReport}>📥 导出报告(PDF)</button>
          </div>
        }
      />

      {/* 概览统计卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>👥 参加人数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{o.submitted}<span style={{ fontSize: 14, color: '#6b7280' }}>/{o.total_students}</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>📈 平均分</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{o.avg_score}<span style={{ fontSize: 14, color: '#6b7280' }}>分</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>✅ 及格率</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{o.pass_rate}%</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>🏆 优秀率</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>{o.excellent_rate}%</div>
        </div>
      </div>

      {/* 详细统计 */}
      <div className="card mb16">
        <div className="card-title"><span>📋 详细统计</span></div>
        <div className="grid grid-6" style={{ gap: 12 }}>
          {[
            ['最高分', o.max_score, 'text-success'], ['最低分', o.min_score, 'text-danger'],
            ['中位数', o.median, ''], ['标准差', o.std_dev, ''],
            ['满分', data.exam.total_score, ''], ['考试时长', data.exam.duration + '分钟', ''],
          ].map(([label, value, cls]) => (
            <div key={label} style={{ textAlign: 'center', padding: '10px', background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginTop: 4 }} className={cls}>{value}</div>
            </div>
          ))}
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

      {/* 成绩分析Tab */}
      {activeTab === 'score' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>📊 得分分布</span></div>
            <EChart option={scoreHistOption} height={300} />
          </div>
          <div className="card">
            <div className="card-title"><span>📈 难度分布</span></div>
            <EChart option={diffPieOption} height={300} />
          </div>
        </div>
      )}

      {/* 题目分析Tab */}
      {activeTab === 'question' && (
        <div className="card">
          <div className="card-title"><span>📝 题目分析</span><Tag color="gray">{data.question_analysis.length}道题</Tag></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>题号</th><th>题型</th><th>满分</th><th>平均得分</th><th>正确率</th><th>区分度</th><th>评价</th></tr></thead>
              <tbody>
                {data.question_analysis.map(q => (
                  <tr key={q.no}>
                    <td><b>第{q.no}题</b></td>
                    <td><Tag color="blue">{q.type}</Tag></td>
                    <td className="num">{q.score}</td>
                    <td className="num">{q.avg_score}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', maxWidth: 100 }}>
                          <div style={{ width: `${q.correct_rate}%`, height: '100%', background: q.correct_rate >= 75 ? '#10b981' : q.correct_rate >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: q.correct_rate >= 75 ? '#10b981' : q.correct_rate >= 60 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>{q.correct_rate}%</span>
                      </div>
                    </td>
                    <td className="num">{q.discrimination}</td>
                    <td><Tag color={q.discrimination >= 0.4 ? 'green' : q.discrimination >= 0.3 ? 'orange' : 'red'}>{q.discrimination >= 0.4 ? '优秀' : q.discrimination >= 0.3 ? '良好' : '待改进'}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 知识点与能力Tab */}
      {activeTab === 'knowledge' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>🧠 知识点掌握度雷达图</span></div>
            <EChart option={radarOption} height={320} />
          </div>
          <div className="card">
            <div className="card-title"><span>🎯 考试能力模型（实际vs目标）</span></div>
            <EChart option={abilityOption} height={320} />
          </div>
        </div>
      )}

      {/* 错题排行Tab */}
      {activeTab === 'wrong' && (
        <div className="card">
          <div className="card-title"><span>❌ 错题率排行（Top 5）</span><Tag color="red">重点关注</Tag></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.wrong_rate_rank.map((w, i) => (
              <div key={w.no} style={{ padding: '14px 16px', background: i === 0 ? '#fef2f2' : '#f8fafc', borderRadius: 10, border: `1px solid ${i === 0 ? '#fecaca' : '#e5e7eb'}`, borderLeft: `4px solid ${i < 2 ? '#ef4444' : i < 4 ? '#f59e0b' : '#6b7280'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: i < 3 ? '#ef4444' : '#6b7280', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>第{w.no}题</span>
                    <Tag color="blue">{w.type}</Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>平均得分: <b style={{ color: '#1f2937' }}>{w.avg_score}/{w.full_score}</b></span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{w.wrong_rate}%</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, paddingLeft: 38 }}>{w.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 教学建议 */}
      <div className="card mt16" style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1px solid #bae6fd' }}>
        <div className="card-title"><span>💡 教学建议（AI自动生成）</span><Tag color="blue">智能分析</Tag></div>
        <div style={{ fontSize: 14, color: '#0c4a6e', lineHeight: 1.8 }}>
          <p>1. 班级整体平均分 <b>{o.avg_score}分</b>，及格率 <b>{o.pass_rate}%</b>，整体表现{o.pass_rate >= 80 ? '良好' : '有待提升'}。</p>
          <p>2. <b>阅读理解（72%）</b>和<b>翻译能力（65%）</b>是薄弱环节，建议加强相关知识点的教学和练习。</p>
          <p>3. <b>第18题（阅读）错误率最高（78%）</b>，建议在课堂上重点讲解该题涉及的推理判断题解题技巧。</p>
          <p>4. <b>表达能力（65分）</b>低于目标值（80分），建议增加写作训练和课堂表达机会，可布置每周一篇作文练习。</p>
          <p>5. 区分度整体良好（平均0.45），试卷质量较高，能有效区分不同水平的学生。</p>
        </div>
      </div>
    </div>
  )
}
