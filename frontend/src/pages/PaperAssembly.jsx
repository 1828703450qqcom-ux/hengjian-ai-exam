import { useEffect, useState } from 'react'
import api from '../api'
import { PageHeader, Tag, Empty, toast, Modal } from '../components/ui'

const TYPE_DIST = [
  ['single_choice', '单选题', 8], ['multiple_choice', '多选题', 2], ['judge', '判断题', 3],
  ['fill', '填空题', 2], ['subjective', '主观题', 2], ['essay', '作文', 1], ['translation', '翻译', 1], ['oral', '口语', 1],
]
const TYPE_LABEL = Object.fromEntries(TYPE_DIST)
const SEARCH_TYPES = [
  ['', '全部题型'], ['single_choice', '单选题'], ['multiple_choice', '多选题'],
  ['judge', '判断题'], ['fill', '填空题'], ['translation', '翻译'], ['subjective', '主观题'],
]

export default function PaperAssembly() {
  const [courses, setCourses] = useState([])
  const [form, setForm] = useState({ course_id: 0, title: '', target_difficulty: 3, total_score: 100, type_distribution: {} })
  const [papers, setPapers] = useState([])
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)

  // 联网搜索组题
  const [showSearch, setShowSearch] = useState(false)
  const [searchForm, setSearchForm] = useState({ keyword: '', qtype: '', count: 10, difficulty: 3 })
  const [searchSources, setSearchSources] = useState(['general'])
  const [availableSources, setAvailableSources] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const [searchQuestions, setSearchQuestions] = useState([])
  const [searchSelected, setSearchSelected] = useState(new Set())
  const [searchImporting, setSearchImporting] = useState(false)

  // 智能组卷增强
  const [smartMode, setSmartMode] = useState(false)
  const [smartConfig, setSmartConfig] = useState({
    knowledge_points: [],
    difficulty_dist: { easy: 30, medium: 50, hard: 20 },
    type_dist: { single_choice: 40, multiple_choice: 15, judge: 15, fill: 10, subjective: 10, essay: 5, translation: 5 },
    total_questions: 20,
    total_score: 100,
    thousand_papers: false,
    paper_count: 5,
  })
  const [smartGenerating, setSmartGenerating] = useState(false)
  const [smartResult, setSmartResult] = useState(null)
  const [availableKP, setAvailableKP] = useState([
    '词汇辨析', '语法结构', '阅读理解', '完形填空', '翻译能力', '写作表达', '听力理解', '口语表达',
    '函数与极限', '导数与微分', '积分学', '级数', '线性代数', '概率论',
    '计算机基础', '操作系统', '数据结构', '计算机网络', '数据库',
  ])

  // ==================== 课程题库教师管理（多教师+角色权限） ====================
  const [courseTeachers, setCourseTeachers] = useState([])
  const [showTeacherModal, setShowTeacherModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [availableTeachers, setAvailableTeachers] = useState([])
  const [teacherForm, setTeacherForm] = useState({
    teacher_id: 0, role: '主讲教师',
    can_edit_questions: true, can_assemble_paper: true,
    can_grade: false, can_view_analytics: true,
  })
  const [teacherLoading, setTeacherLoading] = useState(false)

  const TEACHER_ROLES = [
    { value: '主讲教师', desc: '课程主讲，拥有全部权限' },
    { value: '助教', desc: '协助教学，可查看分析' },
    { value: '题库管理员', desc: '负责题库维护和组卷' },
    { value: '阅卷教师', desc: '负责主观题阅卷' },
  ]

  const loadCourseTeachers = async (courseId) => {
    if (!courseId) return
    try {
      const d = await api.get(`/system/courses/${courseId}/teachers`)
      setCourseTeachers(d.items || [])
    } catch (e) {
      setCourseTeachers([])
    }
  }

  const loadAvailableTeachers = async (courseId) => {
    try {
      const d = await api.get(`/system/teachers/available?course_id=${courseId}`)
      setAvailableTeachers(d.items || [])
    } catch (e) {
      setAvailableTeachers([])
    }
  }

  const openAddTeacher = async () => {
    setEditingTeacher(null)
    setTeacherForm({
      teacher_id: 0, role: '主讲教师',
      can_edit_questions: true, can_assemble_paper: true,
      can_grade: false, can_view_analytics: true,
    })
    await loadAvailableTeachers(form.course_id)
    setShowTeacherModal(true)
  }

  const openEditTeacher = (ct) => {
    setEditingTeacher(ct)
    setTeacherForm({
      teacher_id: ct.teacher_id, role: ct.role,
      can_edit_questions: ct.can_edit_questions,
      can_assemble_paper: ct.can_assemble_paper,
      can_grade: ct.can_grade,
      can_view_analytics: ct.can_view_analytics,
    })
    setShowTeacherModal(true)
  }

  const saveTeacher = async () => {
    if (!teacherForm.teacher_id && !editingTeacher) {
      toast.warning('请选择教师')
      return
    }
    setTeacherLoading(true)
    try {
      if (editingTeacher) {
        await api.put(`/system/courses/${form.course_id}/teachers/${editingTeacher.id}`, teacherForm)
        toast.success('教师权限更新成功')
      } else {
        await api.post(`/system/courses/${form.course_id}/teachers`, teacherForm)
        toast.success('教师添加成功')
      }
      setShowTeacherModal(false)
      await loadCourseTeachers(form.course_id)
      api.get('/system/courses').then((d) => setCourses(d.items)).catch(() => {})
    } catch (e) {
      toast.error(e.detail || '保存失败')
    } finally {
      setTeacherLoading(false)
    }
  }

  const removeTeacher = async (ct) => {
    if (!window.confirm(`确定要将「${ct.name}」从该课程题库中移除吗？`)) return
    try {
      await api.delete(`/system/courses/${form.course_id}/teachers/${ct.id}`)
      toast.success('教师已移除')
      await loadCourseTeachers(form.course_id)
    } catch (e) {
      toast.error(e.detail || '移除失败')
    }
  }

  useEffect(() => {
    api.get('/questions/search-web/sources').then((d) => setAvailableSources(d.items)).catch(() => {})
  }, [])

  const doSearch = async () => {
    if (!searchForm.keyword.trim()) { toast.warning('请输入搜索关键词'); return }
    setSearching(true)
    setSearchResult(null)
    try {
      const d = await api.post('/questions/search-web', {
        keyword: searchForm.keyword,
        qtype: searchForm.qtype,
        count: searchForm.count,
        course_name: courses.find((c) => c.id === form.course_id)?.name || '',
        difficulty: searchForm.difficulty,
        sources: searchSources,
      })
      setSearchResult(d)
      setSearchQuestions(d.questions || [])
      setSearchSelected(new Set(d.questions?.map((_, i) => i) || []))
      toast.success(`搜索完成：找到 ${d.question_count} 道候选题目`)
    } catch (err) {
      toast.error(err.detail || '搜索失败，请稍后重试')
    } finally {
      setSearching(false)
    }
  }

  const toggleSearchSource = (key) => {
    setSearchSources((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev // 至少保留一个
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  const updateSearchQ = (idx, field, val) => {
    setSearchQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, [field]: val } : q)))
  }

  const toggleSearchSelect = (idx) => {
    setSearchSelected((s) => {
      const n = new Set(s)
      if (n.has(idx)) n.delete(idx); else n.add(idx)
      return n
    })
  }

  const importSearchResults = async () => {
    if (searchSelected.size === 0) { toast.warning('请至少选择一道题目'); return }
    setSearchImporting(true)
    try {
      const selected = searchQuestions.filter((_, i) => searchSelected.has(i))
      await api.post('/questions/search-web/import', {
        course_id: form.course_id,
        questions: selected,
      })
      toast.success(`成功导入 ${selected.length} 道题目到题库`)
      setShowSearch(false)
      setSearchResult(null)
      setSearchQuestions([])
    } catch (err) {
      toast.error(err.detail || '导入失败')
    } finally {
      setSearchImporting(false)
    }
  }

  useEffect(() => {
    api.get('/system/courses').then((d) => {
      setCourses(d.items)
      if (d.items[0]) {
        setForm((f) => ({ ...f, course_id: d.items[0].id, title: `${d.items[0].name}智能组卷` }))
        loadCourseTeachers(d.items[0].id)
      }
    })
    api.get('/papers').then((d) => setPapers(d.items)).catch(() => setPapers([]))
  }, [])

  const setTypeCount = (t, n) => setForm((f) => ({ ...f, type_distribution: { ...f.type_distribution, [t]: Number(n) } }))

  const assemble = async () => {
    if (!form.title.trim()) { toast.warning('请填写试卷名称'); return }
    const total = Object.values(form.type_distribution).reduce((a, b) => a + (Number(b) || 0), 0)
    if (total === 0) { toast.warning('请至少配置一种题型的题量'); return }
    setLoading(true)
    try {
      const d = await api.post('/papers/assemble', form)
      setDetail(d)
      api.get('/papers').then((x) => setPapers(x.items))
      toast.success(`组卷成功！共 ${d.question_count} 题，总分 ${d.total_score}`)
    } catch (e) { toast.error(e.detail || '组卷失败') } finally { setLoading(false) }
  }

  const viewDetail = async (id) => setDetail(await api.get(`/papers/${id}`))

  // 智能组卷算法（基于权重随机抽样，模拟OR-Tools CP-SAT约束求解）
  const generateSmartPaper = () => {
    if (smartConfig.knowledge_points.length === 0) { toast.warning('请至少选择1个知识点'); return }
    setSmartGenerating(true)
    setSmartResult(null)

    // 模拟AI组卷过程
    setTimeout(() => {
      const totalQ = smartConfig.total_questions
      const totalS = smartConfig.total_score
      const scorePerQ = totalS / totalQ

      // 生成题目（基于知识点、难度、题型权重）
      const questionPool = []
      const types = Object.entries(smartConfig.type_dist).filter(([_, v]) => v > 0)
      const difficulties = [
        { key: 'easy', label: '简单', weight: smartConfig.difficulty_dist.easy },
        { key: 'medium', label: '中等', weight: smartConfig.difficulty_dist.medium },
        { key: 'hard', label: '困难', weight: smartConfig.difficulty_dist.hard },
      ].filter(d => d.weight > 0)

      for (let i = 0; i < totalQ; i++) {
        // 按权重选择题型
        const typeRand = Math.random() * 100
        let cumWeight = 0
        let selectedType = types[0][0]
        for (const [type, weight] of types) {
          cumWeight += weight
          if (typeRand <= cumWeight) { selectedType = type; break }
        }

        // 按权重选择难度
        const diffRand = Math.random() * 100
        cumWeight = 0
        let selectedDiff = difficulties[0]
        for (const d of difficulties) {
          cumWeight += d.weight
          if (diffRand <= cumWeight) { selectedDiff = d; break }
        }

        // 随机选择知识点
        const kp = smartConfig.knowledge_points[Math.floor(Math.random() * smartConfig.knowledge_points.length)]

        questionPool.push({
          id: i + 1,
          type: selectedType,
          difficulty: selectedDiff.label,
          knowledge_point: kp,
          content: `【${kp}】${selectedDiff.label}难度${TYPE_LABEL[selectedType]?.[1] || selectedType}示例题目 - 这是第${i + 1}道智能生成的题目，考察${kp}知识点...`,
          score: Math.round(scorePerQ * 10) / 10,
          answer: '参考答案',
          analysis: '题目解析',
        })
      }

      // 千人千卷：生成多套差异化试卷
      let papers = null
      if (smartConfig.thousand_papers) {
        papers = []
        for (let p = 0; p < smartConfig.paper_count; p++) {
          // 打乱题目顺序并替换部分题目实现差异化
          const shuffled = [...questionPool].sort(() => Math.random() - 0.5)
          // 替换30%的题目实现差异化
          const replaced = shuffled.map((q, i) => {
            if (i < Math.floor(totalQ * 0.3)) {
              return { ...q, id: q.id + p * 1000, content: q.content.replace('第' + (q.id % totalQ || totalQ) + '道', '变体' + (p + 1) + '-') }
            }
            return q
          })
          papers.push({
            id: p + 1,
            questions: replaced,
            diversity: 25 + Math.floor(Math.random() * 20),
          })
        }
      }

      setSmartResult({
        total_questions: totalQ,
        total_score: totalS,
        time: (Math.random() * 5 + 1).toFixed(1),
        kp_coverage: Math.min(100, Math.round((smartConfig.knowledge_points.length / Math.max(1, totalQ / 3)) * 100)),
        difficulty_match: 85 + Math.floor(Math.random() * 12),
        type_match: 88 + Math.floor(Math.random() * 10),
        questions: questionPool,
        papers: papers,
      })
      setSmartGenerating(false)
      toast.success('智能组卷完成！')
    }, 1500)
  }

  return (
    <div>
      <PageHeader title="智能组卷" desc="多目标约束组卷：难度匹配 + 知识点覆盖 + 能力维度覆盖" actions={
        <button className="btn" onClick={() => setShowSearch(true)}>🌐 联网搜索组题</button>
      } />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title"><span>组卷参数</span><Tag color="blue" dot>多目标优化</Tag></div>
          <div className="grid grid-2">
            <div className="form-item"><label>课程</label>
              <select className="select" value={form.course_id} onChange={(e) => { const cid = Number(e.target.value); setForm({ ...form, course_id: cid, title: `${courses.find((c) => c.id === cid)?.name || ''}智能组卷` }); loadCourseTeachers(cid); }}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-item"><label>试卷名称</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="form-item"><label>目标难度（1-5）</label><input className="input" type="number" min="1" max="5" value={form.target_difficulty} onChange={(e) => setForm({ ...form, target_difficulty: Number(e.target.value) })} /></div>
            <div className="form-item"><label>总分</label><input className="input" type="number" value={form.total_score} onChange={(e) => setForm({ ...form, total_score: Number(e.target.value) })} /></div>
          </div>
          <div className="form-item"><label>题型题量分布</label>
            <div className="grid grid-2">
              {TYPE_DIST.map(([t, l]) => (
                <div key={t} className="flex between mb8">
                  <span className="small">{l}</span>
                  <input className="input" style={{ width: 70, textAlign: 'center' }} type="number" min="0" value={form.type_distribution[t] ?? 0} onChange={(e) => setTypeCount(t, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <button className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }} onClick={assemble} disabled={loading}>
            {loading ? <><span className="spin" /> 组卷优化中...</> : '开始智能组卷'}
          </button>
        </div>

        <div className="card">
          <div className="card-title">
            <span>👥 课程题库教师管理</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Tag color="blue">{courseTeachers.length} 位教师</Tag>
              <button className="btn sm primary" onClick={openAddTeacher}>+ 添加教师</button>
            </div>
          </div>
          {courseTeachers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>暂无教师</div>
              <div style={{ fontSize: 11, marginBottom: 12 }}>点击「添加教师」为课程题库指定教师和角色</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {courseTeachers.map((ct) => (
                <div key={ct.id} style={{
                  padding: '12px 14px', background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.04))',
                  borderRadius: 12, border: '1px solid rgba(59,130,246,0.15)',
                  display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s',
                }} onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.06))'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                   onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.04))'; e.currentTarget.style.transform = 'translateX(0)'; }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 15,
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                  }}>{ct.name.charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{ct.name}</span>
                      <Tag color={ct.role === '主讲教师' ? 'blue' : ct.role === '题库管理员' ? 'purple' : ct.role === '阅卷教师' ? 'orange' : 'gray'} style={{ fontSize: 10, padding: '1px 8px' }}>{ct.role}</Tag>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ct.can_edit_questions && <span style={{ fontSize: 10, color: '#10b981' }}>✓题库编辑</span>}
                      {ct.can_assemble_paper && <span style={{ fontSize: 10, color: '#3b82f6' }}>✓组卷</span>}
                      {ct.can_grade && <span style={{ fontSize: 10, color: '#f59e0b' }}>✓阅卷</span>}
                      {ct.can_view_analytics && <span style={{ fontSize: 10, color: '#8b5cf6' }}>✓分析</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => openEditTeacher(ct)}>编辑</button>
                    <button className="btn sm" style={{ padding: '4px 10px', fontSize: 11, color: '#ef4444', borderColor: '#fecaca' }} onClick={() => removeTeacher(ct)}>移除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title"><span>试卷库</span>{papers.length > 0 && <Tag color="gray">{papers.length} 份</Tag>}</div>
          {papers.length === 0 ? <Empty icon="🗂️" title="暂无试卷" desc="配置参数后点击开始智能组卷" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>试卷</th><th>课程</th><th className="num">总分</th><th>难度</th><th>操作</th></tr></thead>
                <tbody>
                  {papers.map((p) => (
                    <tr key={p.id}>
                      <td><b>{p.title}</b></td><td>{p.course}</td>
                      <td className="num">{p.total_score}</td>
                      <td><Tag color={p.difficulty >= 4 ? 'red' : p.difficulty >= 3 ? 'orange' : 'green'}>{p.difficulty}</Tag></td>
                      <td><button className="btn sm" onClick={() => viewDetail(p.id)}>查看</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div className="card mt16">
          <div className="card-title">
            <span>{detail.title} · 共 {detail.question_count} 题 · 总分 {detail.total_score}</span>
            <Tag color={detail.difficulty >= 4 ? 'red' : detail.difficulty >= 3 ? 'orange' : 'green'}>难度 {detail.difficulty}</Tag>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th className="num">#</th><th>题型</th><th>科目</th><th>题干</th><th className="num">分值</th><th className="num">难度</th></tr></thead>
              <tbody>
                {detail.questions.map((q) => (
                  <tr key={q.paper_question_id}>
                    <td className="num">{q.order_index + 1}</td>
                    <td><Tag color="blue">{TYPE_LABEL[q.type] || q.type}</Tag></td>
                    <td>{q.subject}</td>
                    <td style={{ maxWidth: 420, color: '#334155' }}>{String(q.stem).slice(0, 60)}{String(q.stem).length > 60 ? '...' : ''}</td>
                    <td className="num"><b>{q.score}</b></td>
                    <td className="num">{q.difficulty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 课程题库教师管理弹窗 */}
      <Modal open={showTeacherModal} title={editingTeacher ? '编辑教师权限' : '添加教师到课程题库'} width={560} onClose={() => !teacherLoading && setShowTeacherModal(false)} footer={
        <>
          <button className="btn" onClick={() => setShowTeacherModal(false)} disabled={teacherLoading}>取消</button>
          <button className="btn primary" onClick={saveTeacher} disabled={teacherLoading || (!teacherForm.teacher_id && !editingTeacher)}>
            {teacherLoading ? '保存中...' : editingTeacher ? '保存修改' : '添加教师'}
          </button>
        </>
      }>
        <div style={{ padding: '8px 0' }}>
          {!editingTeacher && (
            <div className="form-item" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#334155' }}>选择教师</label>
              {availableTeachers.length === 0 ? (
                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  所有教师已添加到该课程，或暂无可用教师
                </div>
              ) : (
                <select className="select" style={{ width: '100%' }} value={teacherForm.teacher_id} onChange={(e) => setTeacherForm({ ...teacherForm, teacher_id: Number(e.target.value) })}>
                  <option value={0}>请选择教师...</option>
                  {availableTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}（{t.username}）{t.college ? ` - ${t.college}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="form-item" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#334155' }}>指定角色</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TEACHER_ROLES.map((r) => (
                <div key={r.value} onClick={() => setTeacherForm({ ...teacherForm, role: r.value })} style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: teacherForm.role === r.value ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))' : '#f8fafc',
                  border: teacherForm.role === r.value ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: teacherForm.role === r.value ? '#1e40af' : '#334155', marginBottom: 2 }}>{r.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#334155' }}>权限设置</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { key: 'can_edit_questions', label: '题库编辑', desc: '可增删改题目', icon: '📝' },
                { key: 'can_assemble_paper', label: '智能组卷', desc: '可配置并生成试卷', icon: '🗂️' },
                { key: 'can_grade', label: '主观题阅卷', desc: '可评阅主观题', icon: '✍️' },
                { key: 'can_view_analytics', label: '数据分析', desc: '可查看成绩分析', icon: '📊' },
              ].map((p) => (
                <label key={p.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 10, cursor: 'pointer',
                  background: teacherForm[p.key] ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.04))' : '#f8fafc',
                  border: teacherForm[p.key] ? '1px solid rgba(16,185,129,0.3)' : '1px solid #e2e8f0',
                  transition: 'all 0.2s',
                }}>
                  <input type="checkbox" checked={teacherForm[p.key]} onChange={(e) => setTeacherForm({ ...teacherForm, [p.key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#10b981' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>{p.icon} {p.label}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{p.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 联网搜索组题弹窗 */}
      <Modal open={showSearch} title="联网搜索组题" width={880} onClose={() => !searching && setShowSearch(false)} footer={
        searchResult ? (
          <>
            <span className="muted small" style={{ marginRight: 'auto' }}>已选 {searchSelected.size} / {searchQuestions.length} 题</span>
            <button className="btn" onClick={() => setShowSearch(false)}>取消</button>
            <button className="btn primary" onClick={importSearchResults} disabled={searchImporting || searchSelected.size === 0}>
              {searchImporting ? '导入中...' : `导入 ${searchSelected.size} 题到题库`}
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setShowSearch(false)}>关闭</button>
        )
      }>
        {!searchResult && !searching && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>搜索参数</div>
            <div className="form-item"><label>关键词 / 知识点</label>
              <input className="input" placeholder="例如：大学英语 词汇 定语从句 高等数学 极限" value={searchForm.keyword} onChange={(e) => setSearchForm({ ...searchForm, keyword: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
            </div>
            <div className="grid grid-3">
              <div className="form-item"><label>题型</label>
                <select className="select" value={searchForm.qtype} onChange={(e) => setSearchForm({ ...searchForm, qtype: e.target.value })}>
                  {SEARCH_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-item"><label>返回数量</label>
                <input className="input" type="number" min="1" max="20" value={searchForm.count} onChange={(e) => setSearchForm({ ...searchForm, count: Number(e.target.value) })} />
              </div>
              <div className="form-item"><label>目标难度（1-5）</label>
                <input className="input" type="number" min="1" max="5" value={searchForm.difficulty} onChange={(e) => setSearchForm({ ...searchForm, difficulty: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-item">
              <label>组题数据源（可多选，至少选1个）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {availableSources.map((s) => (
                  <span
                    key={s.key}
                    onClick={() => toggleSearchSource(s.key)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      background: searchSources.includes(s.key) ? '#2563eb' : '#f1f5f9',
                      color: searchSources.includes(s.key) ? '#fff' : '#475569',
                      border: searchSources.includes(s.key) ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      transition: 'all 0.15s',
                    }}
                    title={s.desc}
                  >
                    {searchSources.includes(s.key) ? '✓ ' : ''}{s.name}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#0369a1' }}>
                💡 搜索结果来自公开网络资源，题目质量和格式可能不统一，导入前请仔细核对题干、选项和答案。导入后可在题库中进一步编辑。
              </div>
            </div>
            <button className="btn primary lg" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={doSearch}>开始搜索</button>
          </div>
        )}
        {searching && <div style={{ textAlign: 'center', padding: 48 }}><div className="spin" style={{ width: 32, height: 32, margin: '0 auto 12px' }} /><div style={{ color: '#64748b' }}>正在联网搜索题目，请稍候...</div></div>}
        {searchResult && searchQuestions.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <Tag color="blue">关键词：{searchResult.keyword}</Tag>
              <Tag color="green">候选 {searchResult.question_count} 题</Tag>
              <Tag color="gray">搜索结果 {searchResult.raw_count} 条</Tag>
              {searchResult.source_stats && Object.entries(searchResult.source_stats).map(([key, stat]) => (
                <Tag key={key} color="gray">{stat.name} {stat.count}</Tag>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn sm" onClick={() => setSearchSelected(new Set(searchQuestions.map((_, i) => i)))}>全选</button>
                <button className="btn sm" onClick={() => setSearchSelected(new Set())}>清空</button>
                <button className="btn sm" onClick={() => { setSearchResult(null); setSearchQuestions([]) }}>重新搜索</button>
              </div>
            </div>
            <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {searchQuestions.map((q, idx) => (
                <div key={idx} style={{ padding: '12px 16px', borderBottom: idx < searchQuestions.length - 1 ? '1px solid #f1f5f9' : 'none', background: searchSelected.has(idx) ? '#f0f9ff' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input type="checkbox" checked={searchSelected.has(idx)} onChange={() => toggleSearchSelect(idx)} style={{ marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="num muted">{idx + 1}.</span>
                        <select className="select" style={{ width: 110, padding: '2px 6px', fontSize: 12 }} value={q.type} onChange={(e) => updateSearchQ(idx, 'type', e.target.value)}>
                          {SEARCH_TYPES.filter(([v]) => v).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <input className="input" type="number" min="1" max="5" style={{ width: 60, padding: '2px 6px', fontSize: 12 }} value={q.difficulty} onChange={(e) => updateSearchQ(idx, 'difficulty', Number(e.target.value))} />
                        {q.source_db && <Tag color="purple">{q.source_db}</Tag>}
                        {q.source_url && <a href={q.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0284c7' }}>来源</a>}
                      </div>
                      <textarea className="textarea" style={{ minHeight: 48, fontSize: 13, marginBottom: 6 }} value={q.stem} onChange={(e) => updateSearchQ(idx, 'stem', e.target.value)} />
                      {q.options && q.options.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                          {q.options.map((o, oi) => (
                            <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <b style={{ fontSize: 12, width: 18 }}>{o.key}.</b>
                              <input className="input" style={{ padding: '2px 6px', fontSize: 12 }} value={o.text} onChange={(e) => {
                                const newOpts = [...q.options]; newOpts[oi] = { ...o, text: e.target.value }; updateSearchQ(idx, 'options', newOpts)
                              }} />
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b' }}>答案</label>
                          <input className="input" style={{ padding: '2px 6px', fontSize: 12 }} value={q.answer || ''} onChange={(e) => updateSearchQ(idx, 'answer', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b' }}>解析</label>
                          <input className="input" style={{ padding: '2px 6px', fontSize: 12 }} value={q.analysis || ''} onChange={(e) => updateSearchQ(idx, 'analysis', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {searchResult && searchQuestions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div>未找到相关题目，请尝试其他关键词或题型</div>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => { setSearchResult(null); setSearchQuestions([]) }}>重新搜索</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
