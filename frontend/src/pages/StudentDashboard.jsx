import { useState } from 'react'
import { PageHeader, Tag } from '../components/ui'
import EChart from '../components/EChart'

const ABILITY_TREND = [
  { exam: '第1次月考', 词汇: 55, 语法: 58, 阅读: 52, 写作: 60, 听力: 58 },
  { exam: '期中考试', 词汇: 62, 语法: 65, 阅读: 58, 写作: 65, 听力: 62 },
  { exam: '第2次月考', 词汇: 68, 语法: 70, 阅读: 65, 写作: 68, 听力: 66 },
  { exam: '期末考试', 词汇: 72, 语法: 75, 阅读: 70, 写作: 72, 听力: 70 },
]

const STUDY_TIME = [
  { day: '周一', time: 45 }, { day: '周二', time: 60 }, { day: '周三', time: 30 },
  { day: '周四', time: 75 }, { day: '周五', time: 50 }, { day: '周六', time: 90 }, { day: '周日', time: 65 },
]

const KNOWLEDGE_HEATMAP = [
  { name: '词汇辨析', mastery: 72, questions: 45 },
  { name: '语法结构', mastery: 75, questions: 52 },
  { name: '阅读理解', mastery: 70, questions: 38 },
  { name: '完形填空', mastery: 65, questions: 30 },
  { name: '翻译能力', mastery: 68, questions: 25 },
  { name: '写作表达', mastery: 72, questions: 20 },
  { name: '听力理解', mastery: 70, questions: 35 },
  { name: '口语表达', mastery: 58, questions: 15 },
]

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['词汇', '语法', '阅读', '写作', '听力'], top: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: ABILITY_TREND.map(d => d.exam) },
    yAxis: { type: 'value', min: 40, max: 100 },
    series: ['词汇', '语法', '阅读', '写作', '听力'].map((name, i) => ({
      name, type: 'line', data: ABILITY_TREND.map(d => d[name]), smooth: true,
      itemStyle: { color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][i] },
    }))
  }

  const timeOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: STUDY_TIME.map(d => d.day) },
    yAxis: { type: 'value', name: '分钟' },
    series: [{ type: 'bar', data: STUDY_TIME.map(d => d.time), itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] }, label: { show: true, position: 'top' } }]
  }

  return (
    <div>
      <PageHeader
        title="📊 学生学习仪表盘"
        subtitle="学习轨迹 · 能力成长 · 知识点热力图 · 学习目标进度"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['overview', '📈 总览'], ['ability', '🧠 能力成长'], ['knowledge', '📚 知识点'], ['goals', '🎯 学习目标']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#1e40af' : '#6b7280', fontWeight: activeTab === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 学生信息卡片 */}
      <div className="card mb16" style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👨‍🎓</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>张三</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>软工2401班 · 学号: 202401001</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Tag color="white" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10 }}>班级排名: 第5名</Tag>
                <Tag color="white" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10 }}>年级排名: 第28名</Tag>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>87.5</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>综合评分</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>+8.2</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>较上次进步</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>128</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>连续学习天数</div>
            </div>
          </div>
        </div>
      </div>

      {/* 总览 */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-4 mb16">
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>📝 累计练习题量</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>2,345<span style={{ fontSize: 14, color: '#6b7280' }}>道</span></div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>✅ 正确率</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>72.5<span style={{ fontSize: 14, color: '#6b7280' }}>%</span></div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>⏰ 本周学习时长</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>6.8<span style={{ fontSize: 14, color: '#6b7280' }}>小时</span></div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>📚 已掌握知识点</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>45<span style={{ fontSize: 14, color: '#6b7280' }}>/68</span></div>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card-title"><span>📈 能力成长曲线</span></div>
              <EChart option={trendOption} height={300} />
            </div>
            <div className="card">
              <div className="card-title"><span>⏰ 本周学习时长</span></div>
              <EChart option={timeOption} height={300} />
            </div>
          </div>
        </>
      )}

      {/* 能力成长 */}
      {activeTab === 'ability' && (
        <div className="card">
          <div className="card-title"><span>🧠 五维能力成长趋势</span></div>
          <EChart option={trendOption} height={400} />
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {['词汇', '语法', '阅读', '写作', '听力'].map((name, i) => (
              <div key={name} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][i] }}>{ABILITY_TREND[3][name]}</div>
                <div style={{ fontSize: 11, color: '#10b981' }}>↑ {ABILITY_TREND[3][name] - ABILITY_TREND[0][name]}分</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 知识点热力图 */}
      {activeTab === 'knowledge' && (
        <div className="card">
          <div className="card-title"><span>📚 知识点掌握热力图</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {KNOWLEDGE_HEATMAP.map(kp => (
              <div key={kp.name} style={{ padding: 16, borderRadius: 10, background: kp.mastery >= 70 ? '#f0fdf4' : kp.mastery >= 60 ? '#fefce8' : '#fef2f2', border: `1px solid ${kp.mastery >= 70 ? '#bbf7d0' : kp.mastery >= 60 ? '#fef08a' : '#fecaca'}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{kp.name}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: kp.mastery >= 70 ? '#16a34a' : kp.mastery >= 60 ? '#ca8a04' : '#dc2626' }}>{kp.mastery}%</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>已练 {kp.questions} 题</div>
                <div style={{ height: 6, background: '#fff', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${kp.mastery}%`, height: '100%', background: kp.mastery >= 70 ? '#10b981' : kp.mastery >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 学习目标 */}
      {activeTab === 'goals' && (
        <div className="card">
          <div className="card-title"><span>🎯 学习目标进度</span><button className="btn sm primary">+ 新增目标</button></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { name: '英语四级考试', target: '总分≥500分', current: 465, progress: 93, deadline: '2026-12-15', status: '进行中' },
              { name: '掌握Python编程', target: '完成100道编程题', current: 78, progress: 78, deadline: '2026-10-31', status: '进行中' },
              { name: '高等数学期末', target: '考试成绩≥90分', current: 85, progress: 94, deadline: '2026-07-01', status: '已完成' },
              { name: '数据结构复习', target: '掌握全部知识点', current: 45, progress: 45, deadline: '2026-11-30', status: '进行中' },
            ].map((goal, i) => (
              <div key={i} style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{goal.name}</span>
                    <Tag color={goal.status === '已完成' ? 'green' : 'blue'} style={{ marginLeft: 8 }}>{goal.status}</Tag>
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>截止: {goal.deadline}</span>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>目标: {goal.target} · 当前: {goal.current}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${goal.progress}%`, height: '100%', background: goal.progress >= 90 ? '#10b981' : goal.progress >= 60 ? '#3b82f6' : '#f59e0b', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: goal.progress >= 90 ? '#10b981' : goal.progress >= 60 ? '#3b82f6' : '#f59e0b' }}>{goal.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
