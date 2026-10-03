import { useState } from 'react'
import { PageHeader, Tag, toast } from '../components/ui'
import EChart from '../components/EChart'

const QUESTIONS = [
  { id: 1, type: '单选题', subject: '英语', kp: '词汇辨析', difficulty: 0.4, discrimination: 0.65, correct_rate: 0.72, avg_time: 45, usage: 156, status: 'published' },
  { id: 2, type: '单选题', subject: '英语', kp: '语法结构', difficulty: 0.6, discrimination: 0.72, correct_rate: 0.58, avg_time: 62, usage: 142, status: 'published' },
  { id: 3, type: '阅读理解', subject: '英语', kp: '阅读理解', difficulty: 0.75, discrimination: 0.81, correct_rate: 0.42, avg_time: 180, usage: 98, status: 'published' },
  { id: 4, type: '单选题', subject: '数学', kp: '函数与极限', difficulty: 0.35, discrimination: 0.58, correct_rate: 0.78, avg_time: 38, usage: 203, status: 'published' },
  { id: 5, type: '计算题', subject: '数学', kp: '积分计算', difficulty: 0.7, discrimination: 0.75, correct_rate: 0.48, avg_time: 240, usage: 87, status: 'published' },
  { id: 6, type: '单选题', subject: '计算机', kp: '数据结构', difficulty: 0.5, discrimination: 0.68, correct_rate: 0.65, avg_time: 52, usage: 178, status: 'published' },
  { id: 7, type: '简答题', subject: '计算机', kp: '操作系统', difficulty: 0.65, discrimination: 0.70, correct_rate: 0.52, avg_time: 180, usage: 65, status: 'review' },
  { id: 8, type: '判断题', subject: '思政', kp: '马克思主义原理', difficulty: 0.3, discrimination: 0.45, correct_rate: 0.82, avg_time: 25, usage: 134, status: 'published' },
]

export default function QuestionBankManage() {
  const [activeTab, setActiveTab] = useState('list') // list / quality / import
  const [searchText, setSearchText] = useState('')
  const [filterSubject, setFilterSubject] = useState('全部')

  const filteredQuestions = QUESTIONS.filter(q => {
    if (filterSubject !== '全部' && q.subject !== filterSubject) return false
    if (searchText && !q.kp.includes(searchText) && !q.type.includes(searchText)) return false
    return true
  })

  const qualityOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['难度指数', '区分度'], top: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: QUESTIONS.map(q => `Q${q.id}`) },
    yAxis: { type: 'value', min: 0, max: 1 },
    series: [
      { name: '难度指数', type: 'bar', data: QUESTIONS.map(q => q.difficulty), itemStyle: { color: '#3b82f6' } },
      { name: '区分度', type: 'line', data: QUESTIONS.map(q => q.discrimination), itemStyle: { color: '#ef4444' }, smooth: true },
    ]
  }

  return (
    <div>
      <PageHeader
        title="📚 题库管理系统（增强版）"
        subtitle="批量导入 · 知识点标签 · 难度自动标定 · 题目质量分析 · 版本管理"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['list', '📋 题目列表'], ['quality', '📊 质量分析'], ['import', '📥 批量导入']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#1e40af' : '#6b7280', fontWeight: activeTab === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 统计卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>📝 题目总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>12,458</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 已发布</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>11,892</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>⏳ 待审核</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>566</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>🏷️ 知识点标签</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>1,234</div>
        </div>
      </div>

      {/* 题目列表 */}
      {activeTab === 'list' && (
        <div className="card">
          <div className="card-title">
            <span>📋 题目列表</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input sm" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                {['全部', '英语', '数学', '计算机', '思政'].map(s => <option key={s}>{s}</option>)}
              </select>
              <input className="input sm" placeholder="搜索知识点/题型..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 180 }} />
              <button className="btn sm primary" onClick={() => toast.success('已打开新增题目对话框')}>+ 新增题目</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>题型</th><th>学科</th><th>知识点</th><th>难度</th><th>区分度</th><th>正确率</th><th>平均用时</th><th>使用次数</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {filteredQuestions.map(q => (
                  <tr key={q.id}>
                    <td className="small muted">Q{q.id}</td>
                    <td><Tag color="blue">{q.type}</Tag></td>
                    <td>{q.subject}</td>
                    <td className="small">{q.kp}</td>
                    <td><span style={{ color: q.difficulty > 0.6 ? '#ef4444' : q.difficulty > 0.4 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>{Math.round(q.difficulty * 100)}%</span></td>
                    <td><span style={{ color: q.discrimination > 0.7 ? '#10b981' : q.discrimination > 0.5 ? '#f59e0b' : '#ef4444' }}>{q.discrimination.toFixed(2)}</span></td>
                    <td>{Math.round(q.correct_rate * 100)}%</td>
                    <td className="small muted">{q.avg_time}s</td>
                    <td className="num">{q.usage}</td>
                    <td><Tag color={q.status === 'published' ? 'green' : 'orange'}>{q.status === 'published' ? '已发布' : '待审核'}</Tag></td>
                    <td><div className="flex"><button className="btn sm">编辑</button><button className="btn sm">预览</button><button className="btn sm" style={{ color: '#ef4444' }}>删除</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 质量分析 */}
      {activeTab === 'quality' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>📊 题目难度与区分度分析</span></div>
            <EChart option={qualityOption} height={350} />
          </div>
          <div className="card">
            <div className="card-title"><span>⚠️ 低质量题目预警</span></div>
            <div style={{ maxHeight: 350, overflowY: 'auto' }}>
              {QUESTIONS.filter(q => q.discrimination < 0.5 || q.difficulty < 0.2 || q.difficulty > 0.9).map(q => (
                <div key={q.id} style={{ padding: '10px 12px', marginBottom: 8, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', borderLeft: '3px solid #ef4444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Q{q.id} - {q.kp}</span>
                    <Tag color="red">低质量</Tag>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    区分度: {q.discrimination.toFixed(2)}（{q.discrimination < 0.5 ? '偏低' : '正常'}）· 
                    难度: {Math.round(q.difficulty * 100)}%（{q.difficulty < 0.2 ? '过易' : q.difficulty > 0.9 ? '过难' : '正常'}）
                  </div>
                  <button className="btn sm" style={{ marginTop: 6, fontSize: 11 }}>优化题目</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 批量导入 */}
      {activeTab === 'import' && (
        <div className="card">
          <div className="card-title"><span>📥 批量导入题目</span></div>
          <div style={{ padding: 40, textAlign: 'center', border: '2px dashed #e5e7eb', borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>拖拽文件到此处，或点击上传</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>支持 Word(.docx)、Excel(.xlsx)、PDF格式，单次最多导入500题</div>
            <button className="btn primary" onClick={() => toast.success('文件选择对话框已打开')}>选择文件</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📄 Word模板说明</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
                <div>1. 第一行：题型（单选题/多选题/判断题/填空题/简答题）</div>
                <div>2. 第二行：题目内容</div>
                <div>3. 选项行（A. B. C. D.）</div>
                <div>4. 答案行：答案：XXX</div>
                <div>5. 解析行：解析：XXX</div>
                <div>6. 知识点行：知识点：XXX</div>
              </div>
              <button className="btn sm" style={{ marginTop: 12 }}>下载Word模板</button>
            </div>
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📊 Excel模板说明</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
                <div>列：题型 | 题目内容 | 选项A | 选项B | 选项C | 选项D | 答案 | 解析 | 知识点 | 难度</div>
                <div>• 支持图片题（图片嵌入单元格）</div>
                <div>• 难度可选：简单/中等/困难</div>
                <div>• 知识点需与系统已有标签匹配</div>
              </div>
              <button className="btn sm" style={{ marginTop: 12 }}>下载Excel模板</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
