import { useEffect, useState } from 'react'
import api from '../api'
import { PageHeader, Tag, Empty, Loading, toast, confirmDialog, Modal } from '../components/ui'

const EXAM_TYPES = [
  ['online', '线上考试'], ['paper', '纸笔考试'], ['mock', '模拟考试'], ['quiz', '随堂测验'],
]
const STATUS_MAP = {
  draft: { label: '草稿', color: 'gray' },
  published: { label: '已发布', color: 'blue' },
  in_progress: { label: '进行中', color: 'orange' },
  ended: { label: '已结束', color: 'green' },
}

export default function ExamManagement() {
  const [exams, setExams] = useState(null)
  const [courses, setCourses] = useState([])
  const [papers, setPapers] = useState([])
  const [students, setStudents] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showStudents, setShowStudents] = useState(null)
  const [form, setForm] = useState({
    course_id: 0, paper_id: 0, title: '', exam_type: 'online',
    start_time: '', end_time: '', duration_minutes: 90,
    proctor_config: { face: true, behavior: true, voice: true, liveness: true, screen_switch: true },
    exam_config: {
      max_screen_switches: 5,        // 允许切屏次数，超过强制交卷
      screen_switch_warning: 3,      // 切屏警告阈值
      idle_timeout_minutes: 10,      // 无操作超时（分钟）
      shuffle_questions: true,       // 题目顺序乱序
      shuffle_options: true,          // 选项顺序随机
      allow_student_call: true,       // 允许学员呼叫监考员
      show_score_immediately: false,  // 交卷后立即显示成绩
      allow_copy_paste: false,        // 允许复制粘贴
      force_fullscreen: true,         // 强制全屏考试
    },
    ability_dimensions: [
      { key: 'reading', label: '阅读理解能力', weight: 20 },
      { key: 'logic', label: '逻辑推理能力', weight: 20 },
      { key: 'memory', label: '记忆能力', weight: 15 },
      { key: 'analysis', label: '分析能力', weight: 20 },
      { key: 'calculation', label: '计算能力', weight: 15 },
      { key: 'expression', label: '表达能力', weight: 10 },
    ],
  })
  const [saving, setSaving] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState(new Set())
  const [enrolling, setEnrolling] = useState(false)
  // 筛选状态
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')
  const [searchText, setSearchText] = useState('')

  const load = () => {
    api.get('/exams').then((d) => setExams(d.items)).catch(() => setExams([]))
  }
  useEffect(() => {
    load()
    api.get('/system/courses').then((d) => { setCourses(d.items); if (d.items[0]) setForm((f) => ({ ...f, course_id: d.items[0].id })) })
    api.get('/papers').then((d) => setPapers(d.items)).catch(() => setPapers([]))
    api.get('/system/users', { params: { role: 'student' } }).then((d) => setStudents(d.items)).catch(() => setStudents([]))
  }, [])

  const openCreate = () => {
    setForm({
      course_id: courses[0]?.id || 0, paper_id: papers[0]?.id || 0, title: '',
      exam_type: 'online', start_time: '', end_time: '', duration_minutes: 90,
      proctor_config: { face: true, behavior: true, voice: true, liveness: true, screen_switch: true },
      exam_config: {
        max_screen_switches: 5, screen_switch_warning: 3, idle_timeout_minutes: 10,
        shuffle_questions: true, shuffle_options: true, allow_student_call: true,
        show_score_immediately: false, allow_copy_paste: false, force_fullscreen: true,
      },
      ability_dimensions: [
        { key: 'reading', label: '阅读理解能力', weight: 20 },
        { key: 'logic', label: '逻辑推理能力', weight: 20 },
        { key: 'memory', label: '记忆能力', weight: 15 },
        { key: 'analysis', label: '分析能力', weight: 20 },
        { key: 'calculation', label: '计算能力', weight: 15 },
        { key: 'expression', label: '表达能力', weight: 10 },
      ],
    })
    setShowCreate(true)
  }

  const createExam = async () => {
    if (!form.title.trim()) { toast.warning('请填写考试名称'); return }
    if (!form.paper_id) { toast.warning('请选择试卷'); return }
    setSaving(true)
    try {
      const d = await api.post('/exams', form)
      toast.success('考试创建成功')
      setShowCreate(false)
      load()
    } catch (e) { toast.error(e.detail || '创建失败') } finally { setSaving(false) }
  }

  const publishExam = async (eid) => {
    const ok = await confirmDialog({ title: '发布考试', message: '发布后考生将可见并可参加考试，确认发布吗？', confirmText: '确认发布' })
    if (!ok) return
    try {
      await api.post(`/exams/${eid}/publish`)
      toast.success('考试已发布')
      load()
    } catch (e) { toast.error(e.detail || '发布失败') }
  }

  const openStudents = (exam) => {
    setShowStudents(exam)
    setSelectedStudents(new Set())
  }

  const enrollStudents = async () => {
    if (selectedStudents.size === 0) { toast.warning('请至少选择一名考生'); return }
    setEnrolling(true)
    try {
      await api.post(`/exams/${showStudents.id}/enroll`, { user_ids: Array.from(selectedStudents) })
      toast.success(`已添加 ${selectedStudents.size} 名考生`)
      setShowStudents(null)
      load()
    } catch (e) { toast.error(e.detail || '添加失败') } finally { setEnrolling(false) }
  }

  const toggleProctor = (key) => {
    setForm((f) => ({ ...f, proctor_config: { ...f.proctor_config, [key]: !f.proctor_config[key] } }))
  }

  const fmtTime = (t) => t ? t.replace('T', ' ').slice(0, 16) : '--'

  // 筛选后的考试列表
  const filteredExams = (exams || []).filter((e) => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterType !== 'all' && e.exam_type !== filterType) return false
    if (filterCourse !== 'all' && e.course !== filterCourse) return false
    if (searchText && !e.title.toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  // 统计数据
  const stats = {
    total: exams?.length || 0,
    draft: exams?.filter(e => e.status === 'draft').length || 0,
    published: exams?.filter(e => e.status === 'published').length || 0,
    inProgress: exams?.filter(e => e.status === 'in_progress').length || 0,
    ended: exams?.filter(e => e.status === 'ended').length || 0,
  }

  return (
    <div>
      <PageHeader title="考试管理" desc="创建考试 · 发布管理 · 考生分配 · 多模态监考配置" actions={
        <button className="btn primary" onClick={openCreate}>+ 创建考试</button>
      } />

      {/* 统计概览卡片 - Ant Design 专业风格 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px', border: '1px solid #f0f0f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#1677ff' }}></div>
          <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>考试总数</div>
          <div style={{ fontSize: 30, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>{stats.total}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px', border: '1px solid #f0f0f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#faad14' }}></div>
          <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>进行中</div>
          <div style={{ fontSize: 30, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>{stats.inProgress}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px', border: '1px solid #f0f0f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#52c41a' }}></div>
          <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>已发布</div>
          <div style={{ fontSize: 30, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>{stats.published}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px', border: '1px solid #f0f0f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#8c8c8c' }}></div>
          <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>草稿</div>
          <div style={{ fontSize: 30, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>{stats.draft}</div>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="card mb16" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="🔍 搜索考试名称..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220, flex: '0 0 auto' }}
          />
          <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 130 }}>
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="in_progress">进行中</option>
            <option value="ended">已结束</option>
          </select>
          <select className="select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 130 }}>
            <option value="all">全部类型</option>
            {EXAM_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="select" value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} style={{ width: 160 }}>
            <option value="all">全部课程</option>
            {courses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <span className="muted small" style={{ marginLeft: 'auto' }}>
            共 {filteredExams.length} 场考试
          </span>
          {(filterStatus !== 'all' || filterType !== 'all' || filterCourse !== 'all' || searchText) && (
            <button className="btn sm" onClick={() => { setFilterStatus('all'); setFilterType('all'); setFilterCourse('all'); setSearchText('') }}>
              清除筛选
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span>考试列表</span>{exams && <Tag color="gray" dot>{filteredExams.length} 场</Tag>}</div>
        {!exams ? <Loading rows={4} /> : filteredExams.length === 0 ? <Empty icon="📋" title="暂无符合条件的考试" desc="调整筛选条件或创建新考试" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>考试名称</th><th>课程</th><th>试卷</th><th>类型</th><th>时间</th><th>时长</th><th>状态</th><th>考生</th><th>提交进度</th><th>操作</th></tr></thead>
              <tbody>
                {filteredExams.map((e) => {
                  const st = STATUS_MAP[e.status] || { label: e.status, color: 'gray' }
                  const progress = e.total_sessions > 0 ? Math.round((e.submitted / e.total_sessions) * 100) : 0
                  return (
                    <tr key={e.id}>
                      <td><b>{e.title}</b></td>
                      <td>{e.course}</td>
                      <td style={{ maxWidth: 160 }}>{e.paper_title}</td>
                      <td><Tag color="blue">{EXAM_TYPES.find(([v]) => v === e.exam_type)?.[1] || e.exam_type}</Tag></td>
                      <td className="small muted">{fmtTime(e.start_time)}<br/>~ {fmtTime(e.end_time)}</td>
                      <td className="num">{e.duration_minutes}分钟</td>
                      <td><Tag color={st.color} dot>{st.label}</Tag></td>
                      <td className="num">{e.participants}</td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#10b981' : '#3b82f6', borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <span className="small muted" style={{ minWidth: 40, textAlign: 'right' }}>{e.submitted}/{e.total_sessions}</span>
                        </div>
                      </td>
                      <td><div className="flex">
                        {e.status === 'draft' && <button className="btn sm primary" onClick={() => publishExam(e.id)}>发布</button>}
                        <button className="btn sm" onClick={() => openStudents(e)}>考生</button>
                        {e.status === 'ended' && <button className="btn sm" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }} onClick={() => window.location.href = `/exam-analysis/${e.id}`}>📊 分析</button>}
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 创建考试弹窗 */}
      <Modal open={showCreate} title="创建考试" width={720} onClose={() => !saving && setShowCreate(false)} footer={
        <>
          <button className="btn" onClick={() => setShowCreate(false)}>取消</button>
          <button className="btn primary" onClick={createExam} disabled={saving}>{saving ? '创建中...' : '创建考试'}</button>
        </>
      }>
        <div className="grid grid-2">
          <div className="form-item"><label>考试名称</label>
            <input className="input" placeholder="如：大学英语（二）期末考试" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-item"><label>考试类型</label>
            <select className="select" value={form.exam_type} onChange={(e) => setForm({ ...form, exam_type: e.target.value })}>
              {EXAM_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-item"><label>课程</label>
            <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: Number(e.target.value) })}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-item"><label>试卷</label>
            <select className="select" value={form.paper_id} onChange={(e) => setForm({ ...form, paper_id: Number(e.target.value) })}>
              <option value={0}>请选择试卷</option>
              {papers.map((p) => <option key={p.id} value={p.id}>{p.title}（{p.total_score}分）</option>)}
            </select>
          </div>
          <div className="form-item"><label>开始时间</label>
            <input className="input" type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div className="form-item"><label>结束时间</label>
            <input className="input" type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <div className="form-item"><label>考试时长（分钟）</label>
            <input className="input" type="number" min="1" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
          </div>
        </div>
        <div className="form-item">
          <label>多模态监考配置</label>
          <div className="flex" style={{ flexWrap: 'wrap', gap: 12 }}>
            {[
              ['face', '人脸比对'], ['behavior', '行为识别'], ['voice', '声音监测'],
              ['liveness', '活体核验'], ['screen_switch', '防切屏'],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.proctor_config[key]} onChange={() => toggleProctor(key)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* 企业级防作弊与考试参数配置 */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginTop: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 12 }}>🛡️ 防作弊与考试参数（企业级）</div>
          <div className="grid grid-2" style={{ gap: '10px 16px' }}>
            <div className="form-item" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 12 }}>允许切屏次数（超过强制交卷）</label>
              <input className="input" type="number" min="0" value={form.exam_config.max_screen_switches}
                onChange={(e) => setForm({ ...form, exam_config: { ...form.exam_config, max_screen_switches: Number(e.target.value) } })} />
            </div>
            <div className="form-item" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 12 }}>切屏警告阈值（次）</label>
              <input className="input" type="number" min="0" value={form.exam_config.screen_switch_warning}
                onChange={(e) => setForm({ ...form, exam_config: { ...form.exam_config, screen_switch_warning: Number(e.target.value) } })} />
            </div>
            <div className="form-item" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 12 }}>无操作超时（分钟）</label>
              <input className="input" type="number" min="1" value={form.exam_config.idle_timeout_minutes}
                onChange={(e) => setForm({ ...form, exam_config: { ...form.exam_config, idle_timeout_minutes: Number(e.target.value) } })} />
            </div>
            <div className="form-item" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 12 }}>防作弊开关</label>
              <div className="flex" style={{ flexWrap: 'wrap', gap: 10, paddingTop: 6 }}>
                {[
                  ['shuffle_questions', '题目乱序'],
                  ['shuffle_options', '选项随机'],
                  ['force_fullscreen', '强制全屏'],
                  ['allow_copy_paste', '允许复制'],
                  ['allow_student_call', '学员呼叫'],
                  ['show_score_immediately', '立即出分'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }}>
                    <input type="checkbox" checked={form.exam_config[key]}
                      onChange={() => setForm({ ...form, exam_config: { ...form.exam_config, [key]: !form.exam_config[key] } })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 考试能力模型配置 */}
        <div style={{ background: '#faf5ff', borderRadius: 10, padding: '14px 16px', marginTop: 8, border: '1px solid #e9d5ff' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#5b21b6', marginBottom: 10 }}>
            🧠 考试能力模型配置（考后自动生成能力画像）
          </div>
          <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 10 }}>
            配置本次考试考察的能力维度及权重，考后系统将根据答题情况自动生成学生能力模型
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
            {form.ability_dimensions.map((dim, idx) => (
              <div key={dim.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={dim.weight > 0}
                  onChange={() => {
                    const updated = [...form.ability_dimensions]
                    updated[idx] = { ...dim, weight: dim.weight > 0 ? 0 : 20 }
                    setForm({ ...form, ability_dimensions: updated })
                  }}
                  style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#374151', flex: 1, minWidth: 0 }}>{dim.label}</span>
                <input type="number" min="0" max="100" value={dim.weight}
                  onChange={(e) => {
                    const updated = [...form.ability_dimensions]
                    updated[idx] = { ...dim, weight: Number(e.target.value) }
                    setForm({ ...form, ability_dimensions: updated })
                  }}
                  style={{ width: 50, fontSize: 12, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }} />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>%</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#a78bfa' }}>
            已启用维度权重合计：{form.ability_dimensions.filter(d => d.weight > 0).reduce((a, d) => a + d.weight, 0)}%
            {form.ability_dimensions.filter(d => d.weight > 0).reduce((a, d) => a + d.weight, 0) !== 100 && '（建议合计100%）'}
          </div>
        </div>
      </Modal>

      {/* 考生管理弹窗 */}
      <Modal open={!!showStudents} title={showStudents ? `考生管理 - ${showStudents.title}` : ''} width={640} onClose={() => !enrolling && setShowStudents(null)} footer={
        <>
          <span className="muted small" style={{ marginRight: 'auto' }}>已选 {selectedStudents.size} 人</span>
          <button className="btn" onClick={() => setShowStudents(null)}>关闭</button>
          <button className="btn primary" onClick={enrollStudents} disabled={enrolling || selectedStudents.size === 0}>
            {enrolling ? '添加中...' : `添加 ${selectedStudents.size} 名考生`}
          </button>
        </>
      }>
        {showStudents && (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={() => setSelectedStudents(new Set(students.map((s) => s.id)))}>全选</button>
              <button className="btn sm" onClick={() => setSelectedStudents(new Set())}>清空</button>
              <span className="muted small" style={{ alignSelf: 'center' }}>当前考生：{showStudents.participants} 人</span>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {students.map((s) => (
                <div key={s.id} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => {
                    setSelectedStudents((prev) => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n })
                  }} />
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{(s.name || s.username || '?').slice(0, 1)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name || s.username}</div>
                    <div className="small muted">{s.student_no || s.college || '学生'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


