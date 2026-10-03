import { useState } from 'react'
import { PageHeader, Tag, toast } from '../components/ui'
import EChart from '../components/EChart'

const SURVEYS = [
  { id: 1, name: '2026春季学期课程满意度调查', type: '课程评价', responses: 1256, status: 'ongoing', create_date: '2026-06-01' },
  { id: 2, name: '大学英语教学质量评价', type: '教师评价', responses: 890, status: 'finished', create_date: '2026-05-15' },
  { id: 3, name: '考试系统使用满意度调查', type: '系统评价', responses: 2340, status: 'finished', create_date: '2026-04-20' },
  { id: 4, name: '线上教学效果反馈', type: '教学反馈', responses: 0, status: 'draft', create_date: '2026-06-25' },
]

const QUESTIONS = [
  { id: 1, type: 'single', content: '您对本课程的整体满意度如何？', options: ['非常满意', '满意', '一般', '不满意', '非常不满意'], stats: [45, 35, 12, 5, 3] },
  { id: 2, type: 'single', content: '您认为教师的授课质量如何？', options: ['优秀', '良好', '中等', '较差'], stats: [52, 33, 10, 5] },
  { id: 3, type: 'multiple', content: '您认为本课程哪些方面需要改进？（多选）', options: ['教学内容', '教学方法', '课程难度', '作业量', '考核方式', '互动交流'], stats: [35, 42, 28, 45, 38, 52] },
  { id: 4, type: 'text', content: '您对本课程有什么建议或意见？', responses: 234 },
]

export default function Survey() {
  const [activeTab, setActiveTab] = useState('list') // list / create / stats / answer
  const [selectedSurvey, setSelectedSurvey] = useState(null)
  const [answers, setAnswers] = useState({})

  const satisfactionOption = {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['40%', '70%'],
      data: [
        { value: 45, name: '非常满意', itemStyle: { color: '#10b981' } },
        { value: 35, name: '满意', itemStyle: { color: '#3b82f6' } },
        { value: 12, name: '一般', itemStyle: { color: '#f59e0b' } },
        { value: 5, name: '不满意', itemStyle: { color: '#ef4444' } },
        { value: 3, name: '非常不满意', itemStyle: { color: '#991b1b' } },
      ],
      label: { fontSize: 11 },
    }]
  }

  return (
    <div>
      <PageHeader
        title="📋 问卷调查与满意度评价"
        subtitle="问卷创建 · 在线填写 · 统计分析 · 满意度评价"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['list', '📋 问卷列表'], ['create', '✏️ 创建问卷'], ['stats', '📊 统计分析'], ['answer', '📝 填写问卷']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#1e40af' : '#6b7280', fontWeight: activeTab === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 统计 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>📋 问卷总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>56</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 已完成</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>48</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>🔄 进行中</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>6</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>📝 累计回收</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>12,486</div>
        </div>
      </div>

      {/* 问卷列表 */}
      {activeTab === 'list' && (
        <div className="card">
          <div className="card-title">
            <span>📋 问卷列表</span>
            <button className="btn sm primary" onClick={() => setActiveTab('create')}>+ 创建问卷</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>问卷名称</th><th>类型</th><th>回收数</th><th>创建日期</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {SURVEYS.map(survey => (
                  <tr key={survey.id}>
                    <td><b>{survey.name}</b></td>
                    <td><Tag color="blue">{survey.type}</Tag></td>
                    <td className="num">{survey.responses}</td>
                    <td className="small muted">{survey.create_date}</td>
                    <td><Tag color={survey.status === 'finished' ? 'green' : survey.status === 'ongoing' ? 'orange' : 'gray'}>{survey.status === 'finished' ? '已结束' : survey.status === 'ongoing' ? '进行中' : '草稿'}</Tag></td>
                    <td>
                      <div className="flex">
                        <button className="btn sm" onClick={() => { setSelectedSurvey(survey); setActiveTab('stats') }}>统计</button>
                        <button className="btn sm" onClick={() => { setSelectedSurvey(survey); setActiveTab('answer') }}>填写</button>
                        <button className="btn sm">编辑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 创建问卷 */}
      {activeTab === 'create' && (
        <div className="card">
          <div className="card-title"><span>✏️ 创建新问卷</span></div>
          <div style={{ maxWidth: 700 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>问卷名称</label>
              <input className="input" placeholder="请输入问卷名称" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>问卷类型</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['课程评价', '教师评价', '教学反馈', '系统评价', '其他'].map(type => (
                  <button key={type} className="btn sm">{type}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>问卷描述</label>
              <textarea className="input" placeholder="请输入问卷描述（选填）" rows={3} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>题目列表</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm">+ 单选题</button>
                  <button className="btn sm">+ 多选题</button>
                  <button className="btn sm">+ 文本题</button>
                  <button className="btn sm">+ 评分题</button>
                </div>
              </div>
              <div style={{ padding: 20, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '2px dashed #e5e7eb', color: '#9ca3af' }}>
                点击上方按钮添加题目
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn primary" onClick={() => toast.success('问卷已保存为草稿')}>保存草稿</button>
              <button className="btn" onClick={() => toast.success('问卷已发布')}>发布问卷</button>
            </div>
          </div>
        </div>
      )}

      {/* 统计分析 */}
      {activeTab === 'stats' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>📊 整体满意度分布</span></div>
            <EChart option={satisfactionOption} height={300} />
          </div>
          <div className="card">
            <div className="card-title"><span>📈 关键指标</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '整体满意度', value: '80%', color: '#10b981' },
                { label: '教师评分', value: '4.5/5', color: '#3b82f6' },
                { label: '课程难度适中', value: '72%', color: '#8b5cf6' },
                { label: '推荐意愿', value: '85%', color: '#f59e0b' },
              ].map((stat, i) => (
                <div key={i} style={{ padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-title"><span>📋 各题目统计详情</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {QUESTIONS.filter(q => q.type !== 'text').map(q => (
                <div key={q.id} style={{ padding: 14, background: '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Q{q.id}. {q.content}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.options.map((opt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, minWidth: 80 }}>{opt}</span>
                        <div style={{ flex: 1, height: 20, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: `${q.stats[i]}%`, height: '100%', background: '#3b82f6', borderRadius: 4 }} />
                          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#1f2937', fontWeight: 600 }}>{q.stats[i]}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 填写问卷 */}
      {activeTab === 'answer' && (
        <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
          <div className="card-title"><span>📝 {selectedSurvey?.name || '填写问卷'}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {QUESTIONS.map(q => (
              <div key={q.id} style={{ padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Q{q.id}. {q.content} <Tag color="gray" style={{ fontSize: 10 }}>{q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '文本'}</Tag></div>
                {q.type === 'single' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {q.options.map((opt, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff', borderRadius: 6, cursor: 'pointer', border: answers[q.id] === i ? '2px solid #3b82f6' : '1px solid #e5e7eb' }}>
                        <input type="radio" name={`q${q.id}`} checked={answers[q.id] === i} onChange={() => setAnswers({ ...answers, [q.id]: i })} />
                        <span style={{ fontSize: 13 }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'multiple' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {q.options.map((opt, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff', borderRadius: 6, cursor: 'pointer', border: '1px solid #e5e7eb' }}>
                        <input type="checkbox" />
                        <span style={{ fontSize: 13 }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'text' && (
                  <textarea className="input" placeholder="请输入您的建议或意见..." rows={4} />
                )}
              </div>
            ))}
            <button className="btn primary" style={{ padding: '12px' }} onClick={() => toast.success('问卷提交成功，感谢您的参与！')}>提交问卷</button>
          </div>
        </div>
      )}
    </div>
  )
}
