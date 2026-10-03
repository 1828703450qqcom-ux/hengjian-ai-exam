import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { PageHeader, Tag, Loading, toast, Empty } from '../components/ui'
import EChart from '../components/EChart'

// 演示数据
const DEMO_DATA = {
  classes: [
    { id: 1, name: '会计学2024级1班', students: 45, avg_score: 78.5, pass_rate: 88.9 },
    { id: 2, name: '会计学2024级2班', students: 43, avg_score: 75.2, pass_rate: 83.7 },
    { id: 3, name: '金融学2024级1班', students: 48, avg_score: 82.1, pass_rate: 91.7 },
  ],
  exams: [
    { id: 1, title: '大学英语（二）期末考试', course: '大学英语', date: '2026-06-20', students: 45, avg: 76.5, pass: 85.7 },
    { id: 2, title: '高等数学期中考试', course: '高等数学', date: '2026-05-15', students: 45, avg: 72.3, pass: 80.0 },
    { id: 3, title: '计算机基础期末考试', course: '计算机基础', date: '2026-06-25', students: 45, avg: 85.2, pass: 95.6 },
  ],
  student_ranking: [
    { rank: 1, name: '张三', student_no: '202401001', score: 98, change: 2, trend: 'up' },
    { rank: 2, name: '李四', student_no: '202401002', score: 95, change: 0, trend: 'same' },
    { rank: 3, name: '王五', student_no: '202401003', score: 92, change: 5, trend: 'up' },
    { rank: 4, name: '赵六', student_no: '202401004', score: 88, change: -1, trend: 'down' },
    { rank: 5, name: '钱七', student_no: '202401005', score: 85, change: 3, trend: 'up' },
    { rank: 6, name: '孙八', student_no: '202401006', score: 82, change: -2, trend: 'down' },
    { rank: 7, name: '周九', student_no: '202401007', score: 78, change: 1, trend: 'up' },
    { rank: 8, name: '吴十', student_no: '202401008', score: 75, change: -3, trend: 'down' },
    { rank: 9, name: '郑十一', student_no: '202401009', score: 72, change: 0, trend: 'same' },
    { rank: 10, name: '王十二', student_no: '202401010', score: 68, change: -5, trend: 'down' },
  ],
  question_correct_rate: [
    { no: 1, type: '听力', correct_rate: 85, avg_score: 12.8, full_score: 15 },
    { no: 2, type: '阅读', correct_rate: 72, avg_score: 21.6, full_score: 30 },
    { no: 3, type: '完形', correct_rate: 65, avg_score: 9.8, full_score: 15 },
    { no: 4, type: '翻译', correct_rate: 68, avg_score: 10.2, full_score: 15 },
    { no: 5, type: '作文', correct_rate: 74, avg_score: 18.5, full_score: 25 },
  ],
  score_trend: [
    { exam: '第一次月考', avg: 68.5, pass: 75.6 },
    { exam: '期中考试', avg: 72.3, pass: 80.0 },
    { exam: '第二次月考', avg: 74.8, pass: 82.2 },
    { exam: '期末考试', avg: 76.5, pass: 85.7 },
  ],
  weak_points: [
    { name: '阅读理解·推理判断', wrong_rate: 78, students: 35, suggestion: '加强推理判断题解题技巧训练，每周布置2篇专项练习' },
    { name: '完形填空·词汇辨析', wrong_rate: 72, students: 32, suggestion: '增加词汇量积累，重点讲解易混淆词汇的用法区别' },
    { name: '翻译·长难句处理', wrong_rate: 68, students: 30, suggestion: '加强长难句分析训练，讲解翻译技巧和常用句型' },
    { name: '写作·议论文结构', wrong_rate: 58, students: 26, suggestion: '讲解议论文写作框架，提供模板和范文，增加写作练习' },
  ],
}

export default function TeacherDashboard() {
  const [data, setData] = useState(DEMO_DATA)
  const [loading, setLoading] = useState(true)
  const [activeClass, setActiveClass] = useState(1)
  const [activeExam, setActiveExam] = useState(1)
  const navigate = useNavigate()

  useEffect(() => {
    setTimeout(() => setLoading(false), 500)
  }, [])

  // 成绩趋势图
  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { data: ['平均分', '及格率(%)'], top: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    grid: { left: 50, right: 50, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: data.score_trend.map(d => d.exam), axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: [
      { type: 'value', name: '平均分', min: 0, max: 100, axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      { type: 'value', name: '及格率(%)', min: 0, max: 100, axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { show: false } },
    ],
    series: [
      { name: '平均分', type: 'line', smooth: true, data: data.score_trend.map(d => d.avg), itemStyle: { color: '#3b82f6' }, areaStyle: { color: 'rgba(59,130,246,0.15)' }, label: { show: true, position: 'top', fontSize: 11, color: '#6b7280' } },
      { name: '及格率(%)', type: 'line', smooth: true, yAxisIndex: 1, data: data.score_trend.map(d => d.pass), itemStyle: { color: '#10b981' }, label: { show: true, position: 'top', fontSize: 11, color: '#6b7280' } },
    ]
  }), [data])

  // 题目正确率柱状图
  const questionOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: data.question_correct_rate.map(q => `第${q.no}题(${q.type})`), axisLabel: { color: '#6b7280', fontSize: 10 } },
    yAxis: { type: 'value', name: '正确率(%)', min: 0, max: 100, axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      type: 'bar',
      data: data.question_correct_rate.map(q => ({
        value: q.correct_rate,
        itemStyle: { color: q.correct_rate >= 75 ? '#10b981' : q.correct_rate >= 60 ? '#f59e0b' : '#ef4444', borderRadius: [6, 6, 0, 0] }
      })),
      label: { show: true, position: 'top', fontSize: 11, color: '#6b7280', formatter: '{c}%' },
      barWidth: '50%',
    }]
  }), [data])

  if (loading) return <Loading text="加载教师工作台..." />

  const currentClass = data.classes.find(c => c.id === activeClass)
  const currentExam = data.exams.find(e => e.id === activeExam)

  return (
    <div>
      <PageHeader
        title="👨‍🏫 教师工作台"
        subtitle="班级成绩概览 · 题目分析 · 学生排名 · 教学建议"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" value={activeClass} onChange={e => setActiveClass(Number(e.target.value))} style={{ width: 200 }}>
              {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        }
      />

      {/* 班级概览卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>👥 班级人数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{currentClass?.students}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>📈 班级平均分</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{currentClass?.avg_score}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>✅ 及格率</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{currentClass?.pass_rate}%</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>📝 考试场次</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>{data.exams.length}</div>
        </div>
      </div>

      {/* 成绩趋势 + 题目正确率 */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-title"><span>📈 班级成绩趋势</span><Tag color="blue">{data.score_trend.length}次考试</Tag></div>
          <EChart option={trendOption} height={300} />
        </div>
        <div className="card">
          <div className="card-title"><span>📝 题目正确率统计</span><Tag color="orange">薄弱题重点关注</Tag></div>
          <EChart option={questionOption} height={300} />
        </div>
      </div>

      {/* 学生排名 + 薄弱知识点 */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 学生排名 */}
        <div className="card">
          <div className="card-title">
            <span>🏆 学生成绩排名（Top 10）</span>
            <Tag color="gray">{currentClass?.students}人</Tag>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {data.student_ranking.map(s => (
              <div key={s.student_no} style={{
                padding: '10px 14px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', gap: 12,
                background: s.rank <= 3 ? '#f8fafc' : 'transparent',
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: s.rank === 1 ? '#fbbf24' : s.rank === 2 ? '#9ca3af' : s.rank === 3 ? '#d97706' : '#e5e7eb',
                  color: s.rank <= 3 ? '#fff' : '#6b7280',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>{s.rank}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.student_no}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.score >= 90 ? '#10b981' : s.score >= 60 ? '#3b82f6' : '#ef4444' }}>
                  {s.score}
                </div>
                <div style={{ fontSize: 12, color: s.trend === 'up' ? '#10b981' : s.trend === 'down' ? '#ef4444' : '#9ca3af', minWidth: 50, textAlign: 'right' }}>
                  {s.trend === 'up' ? `↑${s.change}` : s.trend === 'down' ? `↓${Math.abs(s.change)}` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 薄弱知识点与教学建议 */}
        <div className="card">
          <div className="card-title">
            <span>💡 薄弱知识点与教学建议</span>
            <Tag color="red">AI智能分析</Tag>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.weak_points.map((w, i) => (
              <div key={i} style={{
                padding: '12px 14px', background: i === 0 ? '#fef2f2' : '#f8fafc',
                borderRadius: 10, border: `1px solid ${i === 0 ? '#fecaca' : '#e5e7eb'}`,
                borderLeft: `4px solid ${i < 2 ? '#ef4444' : '#f59e0b'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>{w.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{w.students}人错误</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{w.wrong_rate}%</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6, background: '#fff', padding: '8px 10px', borderRadius: 6 }}>
                  📌 {w.suggestion}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 考试列表 */}
      <div className="card">
        <div className="card-title"><span>📋 考试列表</span><Tag color="gray">{data.exams.length}场</Tag></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>考试名称</th><th>课程</th><th>考试日期</th><th>参加人数</th><th>平均分</th><th>及格率</th><th>操作</th></tr></thead>
            <tbody>
              {data.exams.map(e => (
                <tr key={e.id}>
                  <td><b>{e.title}</b></td>
                  <td>{e.course}</td>
                  <td className="small muted">{e.date}</td>
                  <td className="num">{e.students}</td>
                  <td className="num" style={{ color: e.avg >= 80 ? '#10b981' : e.avg >= 60 ? '#3b82f6' : '#ef4444', fontWeight: 600 }}>{e.avg}</td>
                  <td className="num" style={{ color: e.pass >= 85 ? '#10b981' : e.pass >= 70 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>{e.pass}%</td>
                  <td>
                    <div className="flex">
                      <button className="btn sm" onClick={() => navigate(`/exam-analysis/${e.id}`)}>📊 分析报告</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
