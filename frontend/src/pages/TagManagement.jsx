import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

const TAG_TYPE_CONFIG = {
  knowledge: { label: '知识点标签', icon: '🧠', color: '#3b82f6', desc: '选择课程后，可对该课程下的知识点体系进行维护，每个知识点下最多支持5级知识树建设' },
  chapter: { label: '章节标签', icon: '📚', color: '#10b981', desc: '选择课程后，可对该课程下的章节体系进行维护，每章节标签下最多支持5级章节体系建设' },
  difficulty: { label: '难度标签', icon: '📊', color: '#f59e0b', desc: '系统支持给每个课程添加自定义难度标签，每一级难度标签支持0-1难度值设置，难度值数字越大，难度越大' },
  custom: { label: '自定义标签', icon: '🏷️', color: '#8b5cf6', desc: '除系统自带难度、知识点、章节体系，教学负责人可为每个课程添加5个自定义标签体系，每个自定义标签下各子最多支持5级子标签体系建设' },
}

const TagManagement = () => {
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [activeType, setActiveType] = useState('knowledge')
  const [tagTree, setTagTree] = useState([])
  const [typeStats, setTypeStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTag, setEditingTag] = useState(null)
  const [parentTag, setParentTag] = useState(null)
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  const [form, setForm] = useState({
    name: '', code: '', difficulty_value: '', description: '', sort_order: 0
  })

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.get('/system/courses')
      setCourses(res.data?.courses || res.data || [])
    } catch (e) {
      console.error('获取课程列表失败', e)
    }
  }, [])

  const fetchTagData = useCallback(async () => {
    if (!selectedCourse) return
    setLoading(true)
    try {
      const [treeRes, statsRes] = await Promise.all([
        api.get(`/tags/courses/${selectedCourse}/tree?tag_type=${activeType}`),
        api.get(`/tags/courses/${selectedCourse}/types`),
      ])
      setTagTree(treeRes.data?.tree || [])
      setTypeStats(statsRes.data?.tag_types || {})
    } catch (e) {
      console.error('获取标签数据失败', e)
    }
    setLoading(false)
  }, [selectedCourse, activeType])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  useEffect(() => {
    if (selectedCourse) {
      fetchTagData()
    }
  }, [selectedCourse, activeType, fetchTagData])

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedNodes(newExpanded)
  }

  const handleAdd = (parent = null) => {
    setEditingTag(null)
    setParentTag(parent)
    setForm({ name: '', code: '', difficulty_value: '', description: '', sort_order: 0 })
    setShowAddModal(true)
  }

  const handleEdit = (tag) => {
    setEditingTag(tag)
    setParentTag(null)
    setForm({
      name: tag.name,
      code: tag.code || '',
      difficulty_value: tag.difficulty_value !== null && tag.difficulty_value !== undefined ? tag.difficulty_value : '',
      description: tag.description || '',
      sort_order: tag.sort_order || 0,
    })
    setShowAddModal(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      alert('请输入标签名称')
      return
    }
    if (activeType === 'difficulty' && form.difficulty_value !== '') {
      const val = parseFloat(form.difficulty_value)
      if (isNaN(val) || val < 0 || val > 1) {
        alert('难度值必须在0-1之间')
        return
      }
    }

    try {
      if (editingTag) {
        await api.put(`/tags/${editingTag.id}`, {
          name: form.name,
          code: form.code || null,
          difficulty_value: activeType === 'difficulty' && form.difficulty_value !== '' ? parseFloat(form.difficulty_value) : null,
          description: form.description || null,
          sort_order: parseInt(form.sort_order) || 0,
        })
        alert('标签更新成功')
      } else {
        await api.post('/tags', {
          course_id: selectedCourse,
          tag_type: activeType,
          name: form.name,
          code: form.code || null,
          parent_id: parentTag?.id || null,
          difficulty_value: activeType === 'difficulty' && form.difficulty_value !== '' ? parseFloat(form.difficulty_value) : null,
          description: form.description || null,
          sort_order: parseInt(form.sort_order) || 0,
        })
        alert('标签创建成功')
      }
      setShowAddModal(false)
      fetchTagData()
    } catch (e) {
      alert(e.detail || e.message || '操作失败')
    }
  }

  const handleDelete = async (tag) => {
    if (!confirm(`确定要删除标签"${tag.name}"吗？其子标签也将被一并删除。`)) return
    try {
      await api.delete(`/tags/${tag.id}`)
      alert('标签删除成功')
      fetchTagData()
    } catch (e) {
      alert(e.detail || e.message || '删除失败')
    }
  }

  const renderTagNode = (tag, level = 0) => {
    const hasChildren = tag.children && tag.children.length > 0
    const isExpanded = expandedNodes.has(tag.id)
    const config = TAG_TYPE_CONFIG[activeType]

    return (
      <div key={tag.id} style={{ marginBottom: '4px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            background: isExpanded ? 'rgba(59,130,246,0.06)' : 'white',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginLeft: `${level * 24}px`,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
        >
          {/* 展开/折叠按钮 */}
          <span
            style={{
              cursor: hasChildren ? 'pointer' : 'default',
              width: '20px',
              display: 'inline-block',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '12px',
            }}
            onClick={() => hasChildren && toggleExpand(tag.id)}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
          </span>

          {/* 标签图标 */}
          <span style={{ marginRight: '8px', fontSize: '16px' }}>{config.icon}</span>

          {/* 标签名称 */}
          <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px', flex: 1 }}>
            {tag.name}
            {tag.code && <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '8px' }}>({tag.code})</span>}
          </span>

          {/* 难度值 */}
          {activeType === 'difficulty' && tag.difficulty_value !== null && (
            <span style={{
              padding: '2px 8px',
              background: `rgba(245,158,11,${0.1 + tag.difficulty_value * 0.2})`,
              color: '#d97706',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              marginRight: '12px',
            }}>
              难度值: {tag.difficulty_value}
            </span>
          )}

          {/* 层级标签 */}
          <span style={{
            padding: '2px 8px',
            background: 'rgba(100,116,139,0.1)',
            color: '#64748b',
            borderRadius: '12px',
            fontSize: '11px',
            marginRight: '12px',
          }}>
            第{tag.level}级
          </span>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {tag.level < 5 && (
              <button
                onClick={() => handleAdd(tag)}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(59,130,246,0.1)',
                  color: '#2563eb',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                + 子标签
              </button>
            )}
            <button
              onClick={() => handleEdit(tag)}
              style={{
                padding: '4px 10px',
                background: 'rgba(16,185,129,0.1)',
                color: '#059669',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              编辑
            </button>
            <button
              onClick={() => handleDelete(tag)}
              style={{
                padding: '4px 10px',
                background: 'rgba(239,68,68,0.1)',
                color: '#dc2626',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              删除
            </button>
          </div>
        </div>

        {/* 子标签 */}
        {hasChildren && isExpanded && (
          <div style={{ marginTop: '4px' }}>
            {tag.children.map(child => renderTagNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const config = TAG_TYPE_CONFIG[activeType]

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <style>{`
        .tag-management .tm-card {
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          padding: 20px;
        }
        .tag-management .tm-type-tab {
          padding: 12px 20px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          border: 2px solid transparent;
        }
        .tag-management .tm-type-tab:hover {
          background: rgba(59,130,246,0.06);
        }
        .tag-management .tm-type-tab.active {
          background: white;
          border-color: currentColor;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .tag-management .tm-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .tag-management .tm-btn-primary {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }
        .tag-management .tm-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .tag-management .tm-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .tag-management .tm-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .tag-management .tm-label { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block; }
      `}</style>

      <div className="tag-management">
        {/* 页面标题 */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🏷️ 课程标签管理
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
            教学负责人负责课程题库的标签体系维护，对应考试大纲管理，可维护知识点体系、章节体系、难度体系、自定义标签体系，便于后期题库分类管理和查询、组卷等流程顺利进行
          </p>
        </div>

        {/* 课程选择 */}
        <div className="tm-card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#475569' }}>选择课程：</span>
          <select
            className="tm-input"
            style={{ width: '300px' }}
            value={selectedCourse || ''}
            onChange={(e) => setSelectedCourse(parseInt(e.target.value) || null)}
          >
            <option value="">请选择课程</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ''}</option>
            ))}
          </select>
          {selectedCourse && (
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              当前课程：<b style={{ color: '#3b82f6' }}>{courses.find(c => c.id === selectedCourse)?.name}</b>
            </span>
          )}
        </div>

        {selectedCourse && (
          <>
            {/* 标签类型选择 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {Object.entries(TAG_TYPE_CONFIG).map(([type, cfg]) => {
                const stats = typeStats[type]
                return (
                  <div
                    key={type}
                    className={`tm-type-tab ${activeType === type ? 'active' : ''}`}
                    style={{ color: cfg.color, minWidth: '180px' }}
                    onClick={() => setActiveType(type)}
                  >
                    <span style={{ fontSize: '20px' }}>{cfg.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{cfg.label}</div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>
                        {stats ? `${stats.count}个标签` : '加载中...'}
                        {type === 'custom' && stats && ` (${stats.count}/${stats.max_custom_tags})`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 标签类型说明 */}
            <div className="tm-card" style={{ marginBottom: '20px', background: `linear-gradient(135deg, ${config.color}10, ${config.color}05)`, borderLeft: `4px solid ${config.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px' }}>{config.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '16px', color: config.color }}>{config.label}</span>
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: 1.6 }}>{config.desc}</p>
            </div>

            {/* 标签树操作栏 */}
            <div className="tm-card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{config.label}树</span>
                <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: '12px' }}>
                  共 {tagTree.length} 个一级标签，最多支持5级树形结构
                </span>
              </div>
              <button className="tm-btn tm-btn-primary" onClick={() => handleAdd()}>
                + 添加{config.label}
              </button>
            </div>

            {/* 标签树 */}
            <div className="tm-card">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  加载中...
                </div>
              ) : tagTree.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>{config.icon}</div>
                  <p style={{ fontSize: '15px', marginBottom: '8px' }}>暂无{config.label}</p>
                  <p style={{ fontSize: '13px', marginBottom: '20px' }}>点击上方"添加{config.label}"按钮开始创建</p>
                  <button className="tm-btn tm-btn-primary" onClick={() => handleAdd()}>
                    + 添加第一个{config.label}
                  </button>
                </div>
              ) : (
                <div>
                  {tagTree.map(tag => renderTagNode(tag))}
                </div>
              )}
            </div>
          </>
        )}

        {!selectedCourse && (
          <div className="tm-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📚</div>
            <p style={{ fontSize: '15px' }}>请先选择课程</p>
            <p style={{ fontSize: '13px' }}>选择课程后即可管理该课程的标签体系</p>
          </div>
        )}

        {/* 添加/编辑标签弹窗 */}
        {showAddModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={() => setShowAddModal(false)}>
            <div style={{
              background: 'white', borderRadius: '16px', padding: '24px',
              maxWidth: '500px', width: '90%', maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
                {editingTag ? `编辑${config.label}` : `添加${config.label}`}
                {parentTag && <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 400, marginLeft: '8px' }}>（父标签：{parentTag.name}）</span>}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="tm-label">标签名称 *</label>
                  <input
                    className="tm-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={`请输入${config.label}名称`}
                  />
                </div>

                <div>
                  <label className="tm-label">标签编码</label>
                  <input
                    className="tm-input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="请输入标签编码（可选）"
                  />
                </div>

                {activeType === 'difficulty' && (
                  <div>
                    <label className="tm-label">难度值（0-1，数字越大难度越大）</label>
                    <input
                      className="tm-input"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={form.difficulty_value}
                      onChange={(e) => setForm({ ...form, difficulty_value: e.target.value })}
                      placeholder="例如：0.3（简单）、0.5（中等）、0.8（困难）"
                    />
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      {[0.2, 0.4, 0.6, 0.8].map(val => (
                        <button
                          key={val}
                          className="tm-btn"
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            background: `rgba(245,158,11,${0.1 + val * 0.15})`,
                            color: '#d97706',
                          }}
                          onClick={() => setForm({ ...form, difficulty_value: val })}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="tm-label">排序</label>
                  <input
                    className="tm-input"
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    placeholder="排序数字，越小越靠前"
                  />
                </div>

                <div>
                  <label className="tm-label">描述</label>
                  <textarea
                    className="tm-input"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="请输入标签描述（可选）"
                  />
                </div>

                {parentTag && (
                  <div style={{ padding: '12px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
                    ⚠️ 此标签将作为 <b style={{ color: '#3b82f6' }}>"{parentTag.name}"</b> 的子标签，
                    当前层级为第 <b>{parentTag.level + 1}</b> 级（最多支持5级）
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button className="tm-btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={() => setShowAddModal(false)}>
                  取消
                </button>
                <button className="tm-btn tm-btn-primary" onClick={handleSubmit}>
                  {editingTag ? '保存修改' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TagManagement
