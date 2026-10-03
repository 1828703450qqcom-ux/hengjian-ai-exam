import { useEffect, useRef, useState, Fragment } from 'react'
import api from '../api'
import { PageHeader, Tag, Empty, Loading, toast, confirmDialog, Modal } from '../components/ui'

const TYPES = [
  ['single_choice', '单选题'], ['multiple_choice', '多选题'], ['judge', '判断题'],
  ['fill', '填空题'], ['essay', '英语作文'], ['translation', '翻译'], ['oral', '口语'], ['subjective', '主观题'],
]
const TYPE_MAP = Object.fromEntries(TYPES)

export default function QuestionBank() {
  const [items, setItems] = useState(null)
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState(0)
  const [qtype, setQtype] = useState('')
  const [keyword, setKeyword] = useState('')
  const [difficulty, setDifficulty] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [dims, setDims] = useState([])
  const [kps, setKps] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ course_id: 0, type: 'single_choice', subject: '', stem: '', options: [], answer: '', analysis: '', difficulty: 3, kps: [], dims: [] })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  // 文档导入
  const [showImport, setShowImport] = useState(false)
  const [importParsing, setImportParsing] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importQuestions, setImportQuestions] = useState([])
  const [importSelected, setImportSelected] = useState(new Set())
  const [importImporting, setImportImporting] = useState(false)
  const fileInputRef = useRef(null)

  // 多数据源题库中心
  const [showSources, setShowSources] = useState(false)
  const [sources, setSources] = useState([])
  const [sourceKeyword, setSourceKeyword] = useState('')
  const [selectedSources, setSelectedSources] = useState(new Set(['general', 'mooc', 'xuetangx']))
  const [sourceQuestions, setSourceQuestions] = useState([])
  const [sourceSelected, setSourceSelected] = useState(new Set())
  const [sourceSearching, setSourceSearching] = useState(false)
  const [sourceImporting, setSourceImporting] = useState(false)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/\.(docx|pdf|txt|md)$/i.test(file.name)) {
      toast.error('仅支持 .docx / .pdf / .txt / .md 格式')
      return
    }
    setImportParsing(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const d = await api.post('/questions/import/parse', fd, {
        params: { course_id: courseId || courses[0]?.id || 1 },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(d)
      setImportQuestions(d.questions || [])
      setImportSelected(new Set(d.questions?.map((_, i) => i) || []))
      toast.success(`解析完成：共 ${d.total} 题`)
    } catch (err) {
      toast.error(err.detail || '解析失败，请检查文件格式')
    } finally {
      setImportParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const updateImportQ = (idx, field, val) => {
    setImportQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, [field]: val } : q)))
  }

  const toggleImportSelect = (idx) => {
    setImportSelected((s) => {
      const n = new Set(s)
      if (n.has(idx)) n.delete(idx); else n.add(idx)
      return n
    })
  }

  const selectAllImport = () => setImportSelected(new Set(importQuestions.map((_, i) => i)))
  const clearAllImport = () => setImportSelected(new Set())

  const confirmImport = async () => {
    if (importSelected.size === 0) { toast.warning('请至少选择一道题目'); return }
    setImportImporting(true)
    try {
      const selected = importQuestions.filter((_, i) => importSelected.has(i))
      await api.post('/questions/import/confirm', {
        course_id: courseId || courses[0]?.id || 1,
        questions: selected,
      })
      toast.success(`成功导入 ${selected.length} 道题目`)
      setShowImport(false)
      setImportResult(null)
      setImportQuestions([])
      load()
    } catch (err) {
      toast.error(err.detail || '导入失败')
    } finally {
      setImportImporting(false)
    }
  }

  const openImport = () => {
    setShowImport(true)
    setImportResult(null)
    setImportQuestions([])
    setImportSelected(new Set())
  }

  const load = () => {
    api.get('/questions', { params: { course_id: courseId, qtype, keyword } }).then((d) => setItems(d.items)).catch(() => setItems([]))
  }
  useEffect(() => { load() }, [courseId, qtype, keyword])
  useEffect(() => {
    api.get('/system/courses').then((d) => { setCourses(d.items); if (d.items[0]) setForm((f) => ({ ...f, course_id: d.items[0].id })) })
    api.get('/capability/dimensions').then((d) => setDims(d.items))
    api.get('/questions/search-web/sources').then((d) => setSources(d.items || [])).catch(() => {})
  }, [])

  const searchSources = async () => {
    if (!sourceKeyword.trim()) { toast.warning('请输入要扩充的知识主题'); return }
    if (!selectedSources.size) { toast.warning('请至少选择一个数据源'); return }
    setSourceSearching(true); setSourceQuestions([])
    try {
      const course = courses.find(c => c.id === courseId)
      const d = await api.post('/questions/search-web', {
        keyword: sourceKeyword, qtype, count: 20, course_name: course?.name || '',
        difficulty: difficulty || 3, sources: [...selectedSources],
      })
      setSourceQuestions(d.questions || [])
      setSourceSelected(new Set((d.questions || []).map((_, i) => i)))
      toast.success(`已从 ${Object.keys(d.source_stats || {}).length} 个数据源获取 ${d.question_count || 0} 道候选题`)
    } catch (e) { toast.error(e.detail || '数据源检索失败') } finally { setSourceSearching(false) }
  }

  const importSourceQuestions = async () => {
    const selected = sourceQuestions.filter((_, i) => sourceSelected.has(i))
    if (!selected.length) { toast.warning('请选择需要入库的题目'); return }
    setSourceImporting(true)
    try {
      await api.post('/questions/search-web/import', { course_id: courseId || courses[0]?.id || 1, questions: selected })
      toast.success(`成功扩充 ${selected.length} 道题目`); setShowSources(false); load()
      api.get('/questions/search-web/sources').then((d) => setSources(d.items || []))
    } catch (e) { toast.error(e.detail || '导入失败') } finally { setSourceImporting(false) }
  }

  const loadKps = async (cid) => {
    const g = await api.get('/capability/graph', { params: { course_id: cid } })
    setKps(g.nodes || [])
  }

  const save = async () => {
    if (!form.stem.trim()) { toast.warning('请填写题干'); return }
    setSaving(true)
    try {
      if (editing) await api.put(`/questions/${editing}`, form)
      else await api.post('/questions', form)
      setShowForm(false); setEditing(null); load()
      toast.success(editing ? '题目已更新' : '题目创建成功')
    } catch (e) { toast.error(e.detail || '保存失败') } finally { setSaving(false) }
  }

  const remove = async (id) => {
    const ok = await confirmDialog({ title: '删除题目', message: '确认删除该题目吗？删除后不可恢复。', confirmText: '删除', danger: true })
    if (!ok) return
    try { await api.delete(`/questions/${id}`); load(); toast.success('已删除') } catch (e) { toast.error(e.detail || '删除失败') }
  }

  const toggleArr = (key, val) => setForm((f) => ({ ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val] }))
  const openNew = () => { setEditing(null); setForm({ course_id: courses[0]?.id || 0, type: 'single_choice', subject: '', stem: '', options: [], answer: '', analysis: '', difficulty: 3, kps: [], dims: [] }); setShowForm(true) }
  const openEdit = (q) => { setEditing(q.id); setForm({ ...q }); setShowForm(true); loadKps(q.course_id) }

  // 统计数据
  const stats = {
    total: items?.length || 0,
    easy: items?.filter(q => q.difficulty <= 2).length || 0,
    medium: items?.filter(q => q.difficulty === 3).length || 0,
    hard: items?.filter(q => q.difficulty >= 4).length || 0,
  }

  // 难度筛选后的列表
  const filteredItems = (items || []).filter(q => difficulty === 0 || q.difficulty === difficulty)

  const difficultyLabel = (d) => {
    if (d <= 2) return { text: '简单', color: 'green' }
    if (d === 3) return { text: '中等', color: 'orange' }
    return { text: '困难', color: 'red' }
  }

  return (
    <div>
      <PageHeader title="智能题库" desc="题库管理 · 知识点与能力维度标签化，支撑多目标组卷" actions={
        <div className="flex" style={{ gap: 8 }}>
          <button className="btn" onClick={openImport}>📥 导入试卷</button>
          <button className="btn" onClick={() => setShowSources(true)}>🌐 多数据源扩充</button>
          <button className="btn primary" onClick={openNew}>+ 新建题目</button>
        </div>
      } />

      {/* 统计概览卡片 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>📚 题目总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{stats.total}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>🟢 简单题</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{stats.easy}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>🟡 中等题</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{stats.medium}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fee2e2, #fecaca)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fca5a5' }}>
          <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 6 }}>🔴 困难题</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#991b1b' }}>{stats.hard}</div>
        </div>
      </div>

      <div className="source-overview card mb16">
        <div className="source-overview-copy">
          <span className="source-orbit">◎</span>
          <div><b>多源题库网络</b><p>已连接 {sources.filter(s => s.enabled).length} 个教育数据源，统一查重、质量评分后进入校本题库</p></div>
        </div>
        <div className="source-mini-list">
          {sources.slice(0, 6).map(s => <span key={s.key} style={{ '--source-color': s.accent }}><i />{s.name}<em>{s.status === 'ready' ? '在线' : '停用'}</em></span>)}
        </div>
        <button className="btn primary" onClick={() => setShowSources(true)}>打开数据源中心</button>
      </div>

      <div className="filter-bar">
        <div className="fb-item"><span className="fb-label">课程</span>
          <select className="select" value={courseId} onChange={(e) => { setCourseId(Number(e.target.value)); loadKps(Number(e.target.value)) }}>
            <option value={0}>全部课程</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="fb-item"><span className="fb-label">题型</span>
          <select className="select" value={qtype} onChange={(e) => setQtype(e.target.value)}>
            <option value="">全部题型</option>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="fb-item"><span className="fb-label">难度</span>
          <select className="select" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
            <option value={0}>全部难度</option>
            <option value={1}>1星 - 很简单</option>
            <option value={2}>2星 - 简单</option>
            <option value={3}>3星 - 中等</option>
            <option value={4}>4星 - 较难</option>
            <option value={5}>5星 - 很难</option>
          </select>
        </div>
        <div className="search-box" style={{ flex: 1, minWidth: 220, maxWidth: 320 }}>
          <span className="icon">🔍</span>
          <input className="input" placeholder="关键词搜索题干..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span>题库列表</span>{items && <Tag color="gray" dot>{filteredItems.length} 题</Tag>}</div>
        {!items ? <Loading rows={5} /> : filteredItems.length === 0 ? <Empty icon="📚" title="暂无符合条件的题目" desc="调整筛选条件或新建题目" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th className="num">ID</th><th>题型</th><th>科目</th><th>题干</th><th>知识点</th><th className="num">难度</th><th>操作</th></tr></thead>
              <tbody>
                {filteredItems.map((q) => {
                  const dl = difficultyLabel(q.difficulty)
                  const isExpanded = expandedId === q.id
                  return (
                    <Fragment key={q.id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : q.id)}>
                        <td className="num muted">{q.id}</td>
                        <td><Tag color="blue">{TYPES.find(([v]) => v === q.type)?.[1] || q.type}</Tag></td>
                        <td>{q.subject}</td>
                        <td style={{ maxWidth: 380, color: '#334155' }}>
                          {String(q.stem).slice(0, 50)}{String(q.stem).length > 50 ? '...' : ''}
                          <span style={{ marginLeft: 6, color: '#94a3b8', fontSize: 12 }}>{isExpanded ? '▲ 收起' : '▼ 展开'}</span>
                        </td>
                        <td style={{ maxWidth: 160 }}>
                          {(q.kps || []).slice(0, 2).map((kp, i) => (
                            <Tag key={i} color="purple" style={{ marginRight: 4, marginBottom: 2 }}>{kp}</Tag>
                          ))}
                          {(q.kps || []).length > 2 && <span className="small muted">+{q.kps.length - 2}</span>}
                        </td>
                        <td className="num">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: q.difficulty >= 4 ? '#dc2626' : q.difficulty >= 3 ? '#d97706' : '#16a34a' }}>
                              {'★'.repeat(q.difficulty)}{'☆'.repeat(5 - q.difficulty)}
                            </span>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}><div className="flex">
                          <button className="btn sm" onClick={() => openEdit(q)}>编辑</button>
                          <button className="btn sm danger" onClick={() => remove(q.id)}>删除</button>
                        </div></td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={7} style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>完整题干</div>
                                <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>{q.stem}</div>
                                {q.options && q.options.length > 0 && (
                                  <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>选项</div>
                                    {q.options.map((o, i) => (
                                      <div key={i} style={{ fontSize: 13, color: '#334155', padding: '2px 0' }}>
                                        <b>{o.key}.</b> {o.text}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>参考答案</div>
                                <div style={{ fontSize: 14, color: '#16a34a', fontWeight: 600, marginBottom: 12 }}>{q.answer || '暂无'}</div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>解析</div>
                                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{q.analysis || '暂无解析'}</div>
                                {(q.kps || []).length > 0 && (
                                  <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>知识点标签</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {q.kps.map((kp, i) => <Tag key={i} color="purple">{kp}</Tag>)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showForm} title={editing ? '编辑题目' : '新建题目'} width={760} onClose={() => setShowForm(false)} footer={
        <>
          <button className="btn" onClick={() => setShowForm(false)}>取消</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存题目'}</button>
        </>
      }>
        <div className="grid grid-3">
          <div className="form-item"><label>课程</label>
            <select className="select" value={form.course_id} onChange={(e) => { setForm({ ...form, course_id: Number(e.target.value) }); loadKps(Number(e.target.value)) }}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-item"><label>题型</label>
            <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-item"><label>难度（1-5）</label>
            <input className="input" type="number" min="1" max="5" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })} />
          </div>
        </div>
        <div className="form-item"><label>题干</label><textarea className="textarea" value={form.stem} onChange={(e) => setForm({ ...form, stem: e.target.value })} /></div>
        {['single_choice', 'multiple_choice'].includes(form.type) && (
          <div className="form-item">
            <label>选项（A-D）</label>
            {['A', 'B', 'C', 'D'].map((k) => {
              const o = (form.options || []).find((x) => x.key === k)
              return (
                <div className="flex mb8" key={k}>
                  <b style={{ width: 24 }}>{k}.</b>
                  <input className="input" value={o?.text || ''} placeholder={`选项 ${k}`}
                    onChange={(e) => setForm({ ...form, options: [...(form.options || []).filter((x) => x.key !== k), { key: k, text: e.target.value }] })} />
                </div>
              )
            })}
          </div>
        )}
        <div className="form-item"><label>标准答案 / 参考答案要点</label><textarea className="textarea" style={{ minHeight: 60 }} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></div>
        <div className="form-item"><label>解析 / 评分要点（主观题建议填写关键词）</label><textarea className="textarea" style={{ minHeight: 60 }} value={form.analysis} onChange={(e) => setForm({ ...form, analysis: e.target.value })} /></div>
        <div className="form-item"><label>关联知识点</label>
          <div className="flex" style={{ flexWrap: 'wrap' }}>
            {kps.map((k) => (
              <span key={k.id} className={`tag ${form.kps.includes(k.id) ? 'blue' : 'gray'}`} style={{ cursor: 'pointer', margin: 2 }} onClick={() => toggleArr('kps', k.id)}>{k.name}</span>
            ))}
          </div>
        </div>
        <div className="form-item"><label>关联能力维度</label>
          <div className="flex" style={{ flexWrap: 'wrap' }}>
            {dims.slice(0, 40).map((d) => (
              <span key={d.id} className={`tag ${form.dims.includes(d.id) ? 'green' : 'gray'}`} style={{ cursor: 'pointer', margin: 2 }} onClick={() => toggleArr('dims', d.id)}>{d.name}</span>
            ))}
          </div>
        </div>
      </Modal>

      {/* 文档导入弹窗 */}
      <Modal open={showImport} title="导入试卷文档" width={880} onClose={() => !importParsing && setShowImport(false)} footer={
        importResult ? (
          <>
            <span className="muted small" style={{ marginRight: 'auto' }}>已选 {importSelected.size} / {importQuestions.length} 题</span>
            <button className="btn" onClick={() => setShowImport(false)}>取消</button>
            <button className="btn primary" onClick={confirmImport} disabled={importImporting || importSelected.size === 0}>
              {importImporting ? '导入中...' : `确认导入 ${importSelected.size} 题`}
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setShowImport(false)}>关闭</button>
        )
      }>
        <input ref={fileInputRef} type="file" accept=".docx,.pdf,.txt,.md" style={{ display: 'none' }} onChange={handleFileSelect} />
        {!importResult && !importParsing && (
          <div
            style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { fileInputRef.current.files = e.dataTransfer.files; handleFileSelect({ target: { files: [f] } }) } }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>点击或拖拽上传试卷文档</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>支持 Word(.docx) / PDF / TXT / Markdown，自动识别题型、题干、选项、答案与解析</div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['单选题', '多选题', '判断题', '填空题', '翻译题', '主观题'].map((t) => (
                <span key={t} className="tag gray" style={{ fontSize: 12 }}>{t}</span>
              ))}
            </div>
          </div>
        )}
        {importParsing && <div style={{ textAlign: 'center', padding: 48 }}><div className="spin" style={{ width: 32, height: 32, margin: '0 auto 12px' }} /><div style={{ color: '#64748b' }}>正在解析文档，请稍候...</div></div>}
        {importResult && importQuestions.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <Tag color="blue">{importResult.filename}</Tag>
              <Tag color="green">共 {importResult.total} 题</Tag>
              {Object.entries(importResult.type_count || {}).map(([t, c]) => (
                <Tag key={t} color="gray">{TYPE_MAP[t] || t} {c}</Tag>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn sm" onClick={selectAllImport}>全选</button>
                <button className="btn sm" onClick={clearAllImport}>清空</button>
                <button className="btn sm" onClick={() => fileInputRef.current?.click()}>重新上传</button>
              </div>
            </div>
            <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {importQuestions.map((q, idx) => (
                <div key={idx} style={{ padding: '12px 16px', borderBottom: idx < importQuestions.length - 1 ? '1px solid #f1f5f9' : 'none', background: importSelected.has(idx) ? '#f0f9ff' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input type="checkbox" checked={importSelected.has(idx)} onChange={() => toggleImportSelect(idx)} style={{ marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="num muted">{idx + 1}.</span>
                        <select className="select" style={{ width: 110, padding: '2px 6px', fontSize: 12 }} value={q.type} onChange={(e) => updateImportQ(idx, 'type', e.target.value)}>
                          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <input className="input" type="number" min="1" max="5" style={{ width: 60, padding: '2px 6px', fontSize: 12 }} value={q.difficulty} onChange={(e) => updateImportQ(idx, 'difficulty', Number(e.target.value))} placeholder="难度" />
                        {q.score > 0 && <Tag color="orange">{q.score}分</Tag>}
                      </div>
                      <textarea className="textarea" style={{ minHeight: 48, fontSize: 13, marginBottom: 6 }} value={q.stem} onChange={(e) => updateImportQ(idx, 'stem', e.target.value)} />
                      {q.options && q.options.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                          {q.options.map((o, oi) => (
                            <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <b style={{ fontSize: 12, width: 18 }}>{o.key}.</b>
                              <input className="input" style={{ padding: '2px 6px', fontSize: 12 }} value={o.text} onChange={(e) => {
                                const newOpts = [...q.options]; newOpts[oi] = { ...o, text: e.target.value }; updateImportQ(idx, 'options', newOpts)
                              }} />
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b' }}>答案</label>
                          <input className="input" style={{ padding: '2px 6px', fontSize: 12 }} value={q.answer || ''} onChange={(e) => updateImportQ(idx, 'answer', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b' }}>解析</label>
                          <input className="input" style={{ padding: '2px 6px', fontSize: 12 }} value={q.analysis || ''} onChange={(e) => updateImportQ(idx, 'analysis', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {importResult && importQuestions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div>未能从文档中识别出题目，请检查文件格式或内容结构</div>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => fileInputRef.current?.click()}>重新上传</button>
          </div>
        )}
      </Modal>

      <Modal open={showSources} title="多数据源题库扩充中心" width={980} onClose={() => !sourceSearching && setShowSources(false)} footer={
        <div className="flex" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setShowSources(false)}>关闭</button>
          {sourceQuestions.length > 0 && <button className="btn primary" disabled={sourceImporting} onClick={importSourceQuestions}>{sourceImporting ? '正在入库...' : `导入选中题目（${sourceSelected.size}）`}</button>}
        </div>
      }>
        <div className="source-search-bar">
          <div><label>知识主题</label><input className="input" value={sourceKeyword} onChange={e => setSourceKeyword(e.target.value)} placeholder="例如：线性代数矩阵、大学英语四级阅读" onKeyDown={e => e.key === 'Enter' && searchSources()} /></div>
          <button className="btn primary" disabled={sourceSearching} onClick={searchSources}>{sourceSearching ? '正在聚合检索...' : '开始多源检索'}</button>
        </div>
        <div className="source-grid">
          {sources.map(s => <button key={s.key} className={`source-card ${selectedSources.has(s.key) ? 'selected' : ''} ${!s.enabled ? 'disabled' : ''}`} style={{ '--source-color': s.accent }} disabled={!s.enabled} onClick={() => setSelectedSources(prev => { const next = new Set(prev); next.has(s.key) ? next.delete(s.key) : next.add(s.key); return next })}>
            <i>{s.name.slice(0, 1)}</i><span><b>{s.name}</b><small>{s.category} · {s.desc}</small></span><em>{selectedSources.has(s.key) ? '✓' : '+'}</em>
          </button>)}
        </div>
        {sourceSearching && <div className="source-loading"><div className="spin" />正在并行检索、清洗并进行题目质量评分...</div>}
        {sourceQuestions.length > 0 && <div className="source-results">
          <div className="between flex"><b>候选题目</b><span className="small muted">已自动去重并标注来源，共 {sourceQuestions.length} 道</span></div>
          {sourceQuestions.map((q, i) => <label className="source-question" key={i}>
            <input type="checkbox" checked={sourceSelected.has(i)} onChange={() => setSourceSelected(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })} />
            <div><div className="flex"><Tag color="blue">{TYPE_MAP[q.type] || q.type}</Tag><Tag color="gray">{q.source_db || '外部资源'}</Tag><Tag color={q.quality_score >= 85 ? 'green' : 'orange'}>质量 {q.quality_score || 72}</Tag></div><p>{q.stem}</p><small>{q.answer ? `答案：${q.answer}` : '答案待教师复核'} · 难度 {q.difficulty}</small></div>
          </label>)}
        </div>}
      </Modal>
    </div>
  )
}
