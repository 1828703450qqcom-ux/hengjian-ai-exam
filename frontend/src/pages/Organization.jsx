import { useState } from 'react'
import { PageHeader, Tag, toast } from '../components/ui'

const ORG_DATA = {
  school: { name: '河南衡鉴大学', type: 'school', users: 12580, exams: 156 },
  colleges: [
    { id: 1, name: '计算机学院', dean: '张教授', users: 2340, exams: 32, departments: [
      { id: 11, name: '软件工程系', head: '李教授', users: 890, classes: [
        { id: 111, name: '软工2401班', head_teacher: '王老师', students: 45 },
        { id: 112, name: '软工2402班', head_teacher: '赵老师', students: 43 },
      ]},
      { id: 12, name: '计算机科学系', head: '陈教授', users: 780, classes: [
        { id: 121, name: '计科2401班', head_teacher: '刘老师', students: 42 },
      ]},
    ]},
    { id: 2, name: '经济管理学院', dean: '周教授', users: 3120, exams: 45, departments: [
      { id: 21, name: '会计学系', head: '吴教授', users: 1050, classes: [
        { id: 211, name: '会计2401班', head_teacher: '孙老师', students: 48 },
      ]},
    ]},
    { id: 3, name: '外国语学院', dean: '郑教授', users: 1890, exams: 28, departments: [] },
    { id: 4, name: '数学与统计学院', dean: '冯教授', users: 1560, exams: 22, departments: [] },
  ]
}

const ROLES = [
  { key: 'super_admin', name: '校级管理员', count: 5, color: 'red', desc: '全校数据管理、系统配置' },
  { key: 'college_admin', name: '院系管理员', count: 12, color: 'orange', desc: '本院系数据管理、考试组织' },
  { key: 'teacher', name: '教师', count: 856, color: 'blue', desc: '出题、组卷、阅卷、教学分析' },
  { key: 'proctor', name: '监考员', count: 234, color: 'purple', desc: '考试监考、异常处理' },
  { key: 'student', name: '学生', count: 11473, color: 'green', desc: '参加考试、查看成绩、学习' },
]

export default function Organization() {
  const [expandedColleges, setExpandedColleges] = useState(new Set([1]))
  const [expandedDepts, setExpandedDepts] = useState(new Set([11]))
  const [activeTab, setActiveTab] = useState('structure') // structure / roles / users
  const [selectedNode, setSelectedNode] = useState(null)

  const toggleCollege = (id) => {
    const newSet = new Set(expandedColleges)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedColleges(newSet)
  }

  const toggleDept = (id) => {
    const newSet = new Set(expandedDepts)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedDepts(newSet)
  }

  const nodeLeader = selectedNode ? (selectedNode.data.dean || selectedNode.data.head || selectedNode.data['head_teacher'] || '-') : '-'
  const nodeCount = selectedNode ? (selectedNode.data.users || selectedNode.data.students || '-') : '-'

  return (
    <div>
      <PageHeader
        title="🏛️ 多校区组织架构管理"
        subtitle="校→院→系→班四级组织架构 · 权限分级管理 · 数据按院系隔离 · 跨院系联考支持"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['structure', '🏗️ 组织架构'], ['roles', '👥 角色权限'], ['users', '👤 用户管理']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#1e40af' : '#6b7280', fontWeight: activeTab === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 概览 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>🏫 学院数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{ORG_DATA.colleges.length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>📚 系/专业数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{ORG_DATA.colleges.reduce((a, c) => a + c.departments.length, 0) + 8}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>👥 总用户数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>{ORG_DATA.school.users.toLocaleString()}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>📝 累计考试</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>{ORG_DATA.school.exams}</div>
        </div>
      </div>

      {/* 组织架构树 */}
      {activeTab === 'structure' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title"><span>🏗️ 组织架构树</span><button className="btn sm primary" onClick={() => toast.success('已打开新增学院对话框')}>+ 新增学院</button></div>
            {/* 学校节点 */}
            <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', borderRadius: 10, color: '#fff', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>🏫 {ORG_DATA.school.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>校级 · {ORG_DATA.school.users.toLocaleString()}人 · {ORG_DATA.school.exams}场考试</div>
                </div>
                <Tag color="white" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>校级</Tag>
              </div>
            </div>
            {/* 学院列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ORG_DATA.colleges.map(college => (
                <div key={college.id}>
                  <div onClick={() => { toggleCollege(college.id); setSelectedNode({ type: 'college', data: college }) }}
                    style={{ padding: '10px 14px', background: selectedNode?.type === 'college' && selectedNode.data.id === college.id ? '#eff6ff' : '#f8fafc', borderRadius: 8, border: `1px solid ${selectedNode?.type === 'college' && selectedNode.data.id === college.id ? '#3b82f6' : '#e5e7eb'}`, cursor: 'pointer', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{expandedColleges.has(college.id) ? '▼' : '▶'}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>🏛️ {college.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                        <span>院长: {college.dean}</span>
                        <span>{college.users}人</span>
                        <span>{college.exams}场</span>
                      </div>
                    </div>
                  </div>
                  {/* 系列表 */}
                  {expandedColleges.has(college.id) && college.departments.length > 0 && (
                    <div style={{ marginLeft: 24, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {college.departments.map(dept => (
                        <div key={dept.id}>
                          <div onClick={() => { toggleDept(dept.id); setSelectedNode({ type: 'department', data: dept }) }}
                            style={{ padding: '8px 12px', background: selectedNode?.type === 'department' && selectedNode.data.id === dept.id ? '#f0fdf4' : '#fff', borderRadius: 6, border: `1px solid ${selectedNode?.type === 'department' && selectedNode.data.id === dept.id ? '#10b981' : '#e5e7eb'}`, cursor: 'pointer', borderLeft: '3px solid #10b981' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: '#6b7280' }}>{expandedDepts.has(dept.id) ? '▼' : '▶'}</span>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>📚 {dept.name}</span>
                              </div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>系主任: {dept.head} · {dept.users}人</div>
                            </div>
                          </div>
                          {/* 班级列表 */}
                          {expandedDepts.has(dept.id) && dept.classes && (
                            <div style={{ marginLeft: 20, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {dept.classes.map(cls => (
                                <div key={cls.id} onClick={() => setSelectedNode({ type: 'class', data: cls })}
                                  style={{ padding: '6px 10px', background: selectedNode?.type === 'class' && selectedNode.data.id === cls.id ? '#fef3c7' : '#fafafa', borderRadius: 4, border: `1px solid ${selectedNode?.type === 'class' && selectedNode.data.id === cls.id ? '#f59e0b' : '#f0f0f0'}`, cursor: 'pointer', borderLeft: '2px solid #f59e0b', display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 12 }}>👥 {cls.name}</span>
                                  <span style={{ fontSize: 11, color: '#6b7280' }}>班主任: {cls.head_teacher} · {cls.students}人</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 节点详情 */}
          <div className="card">
            <div className="card-title"><span>📋 节点详情</span></div>
            {!selectedNode ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👆</div>
                <div>点击左侧组织架构节点查看详情</div>
              </div>
            ) : (
              <div>
                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>
                    {selectedNode.type === 'college' ? '🏛️' : selectedNode.type === 'department' ? '📚' : '👥'} {selectedNode.data.name}
                  </div>
                  <Tag color={selectedNode.type === 'college' ? 'blue' : selectedNode.type === 'department' ? 'green' : 'orange'}>
                    {selectedNode.type === 'college' ? '学院' : selectedNode.type === 'department' ? '系/专业' : '班级'}
                  </Tag>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>负责人</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{nodeLeader}</div>
                  </div>
                  <div style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>人数</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{nodeCount}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn sm primary">编辑信息</button>
                  <button className="btn sm">查看用户</button>
                  <button className="btn sm">查看考试</button>
                  <button className="btn sm">查看成绩</button>
                  <button className="btn sm" style={{ color: '#ef4444' }}>删除节点</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 角色权限 */}
      {activeTab === 'roles' && (
        <div className="card">
          <div className="card-title"><span>👥 角色与权限管理</span><Tag color="gray">{ROLES.length}个角色</Tag></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {ROLES.map(role => (
              <div key={role.key} style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{role.name}</span>
                  <Tag color={role.color}>{role.count}人</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>{role.desc}</div>
                <button className="btn sm" style={{ width: '100%' }}>配置权限</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 用户管理 */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-title">
            <span>👤 用户管理</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input sm" placeholder="搜索姓名/学号..." style={{ width: 180 }} />
              <button className="btn sm primary">+ 批量导入</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>姓名</th><th>学号/工号</th><th>角色</th><th>所属学院</th><th>所属班级</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {[
                  { name: '张三', no: '202401001', role: '学生', college: '计算机学院', class: '软工2401班', status: 'active' },
                  { name: '李四', no: '202401002', role: '学生', college: '计算机学院', class: '软工2401班', status: 'active' },
                  { name: '王老师', no: 'T2018001', role: '教师', college: '计算机学院', class: '-', status: 'active' },
                  { name: '赵老师', no: 'T2019002', role: '监考员', college: '计算机学院', class: '-', status: 'active' },
                  { name: '张管理员', no: 'A2020001', role: '院系管理员', college: '计算机学院', class: '-', status: 'active' },
                ].map((u, i) => (
                  <tr key={i}>
                    <td><b>{u.name}</b></td>
                    <td className="small muted">{u.no}</td>
                    <td><Tag color={u.role === '学生' ? 'green' : u.role === '教师' ? 'blue' : u.role === '监考员' ? 'purple' : 'orange'}>{u.role}</Tag></td>
                    <td>{u.college}</td>
                    <td className="small muted">{u.class}</td>
                    <td><Tag color="green">正常</Tag></td>
                    <td><div className="flex"><button className="btn sm">编辑</button><button className="btn sm" style={{ color: '#ef4444' }}>禁用</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
