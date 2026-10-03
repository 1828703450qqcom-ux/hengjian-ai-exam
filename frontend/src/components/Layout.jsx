import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { toast, confirmDialog } from './ui'
import NotificationCenter from './NotificationCenter'

const ROLE_META = {
  student: { label: '考生中心', desc: '学生' },
  teacher: { label: '教学工作台', desc: '教师' },
  admin: { label: '管理工作台', desc: '系统管理员' },
  proctor: { label: '监考中心', desc: '监考员' },
}

export default function Layout({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  if (!user) return null

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults(null); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/system/search?q=' + encodeURIComponent(searchQuery), { headers: { Authorization: 'Bearer ' + token } })
        const data = await res.json()
        setSearchResults(data.results || {})
      } catch (e) { setSearchResults({}) } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const role = user.role
  const menus = {
    student: [
      { group: '考生中心', items: [
        { to: '/', label: '我的考试', icon: '📝' },
        { to: '/portrait', label: '能力画像', icon: '🧭' },
        { to: '/student-dashboard', label: '学习仪表盘', icon: '📊' },
        { to: '/adaptive-learning', label: '自适应学习', icon: '🎯' },
        { to: '/wrong-book', label: '错题本', icon: '❌' },
        { to: '/knowledge-graph', label: '知识图谱', icon: '🧠' },
        { to: '/speaking-test', label: '口语测评', icon: '🎤' },
        { to: '/learning-loop', label: '学习闭环', icon: '🔄' },
      ] },
      { group: '学习资源', items: [
        { to: '/live-classroom', label: '直播课堂', icon: '🎥' },
        { to: '/survey', label: '问卷调查', icon: '📋' },
        { to: '/forum', label: '论坛社区', icon: '💬' },
        { to: '/certificate', label: '我的证书', icon: '🏆' },
      ] },
    ],
    teacher: [
      { group: '考试业务', items: [
        { to: '/', label: '工作台', icon: '🏠' },
        { to: '/exam-management', label: '考试管理', icon: '📋' },
        { to: '/question-bank', label: '智能题库', icon: '📚' },
        { to: '/question-bank-manage', label: '题库管理', icon: '📚' },
        { to: '/tag-management', label: '标签管理', icon: '🏷️' },
        { to: '/ai-question-generator', label: 'AI智能出题', icon: '🤖' },
        { to: '/paper-assembly', label: '智能组卷', icon: '🗂️' },
        { to: '/data-import', label: '数据导入', icon: '📥' },
        { to: '/grading', label: 'AI智能评阅', icon: '✅' },
        { to: '/scan-grading', label: '扫描阅卷', icon: '📄' },
        { to: '/print-management', label: '印刷管理', icon: '🖨️' },
        { to: '/exam-recording', label: '录制回放', icon: '🎥' },
      ] },
      { group: '教学分析', items: [
        { to: '/exam-analysis', label: '考试分析', icon: '📊' },
        { to: '/assessment-report', label: '考核评估报告', icon: '📈' },
        { to: '/archive-center', label: '归档中心', icon: '📦' },
        { to: '/teacher-dashboard', label: '教师工作台', icon: '📈' },
        { to: '/course-objective', label: '课程目标达成', icon: '🎯' },
        { to: '/knowledge-graph', label: '知识图谱', icon: '🧠' },
        { to: '/learning-loop', label: '教学反拨', icon: '🔄' },
      ] },
      { group: '管理大屏', items: [
        { to: '/demo-center', label: '全链路演示中心', icon: '🎬' },
        { to: '/proctor-dashboard', label: '实时监考中心', icon: '👁️' },
        { to: '/command', label: '考试指挥中心', icon: '🖥️' },
        { to: '/command-center', label: '数据大屏', icon: '📺' },
      ] },
      { group: '其他', items: [
        { to: '/live-classroom', label: '直播课堂', icon: '🎥' },
        { to: '/survey', label: '问卷调查', icon: '📋' },
        { to: '/forum', label: '论坛社区', icon: '💬' },
        { to: '/certificate', label: '证书管理', icon: '🏆' },
      ] },
    ],
    admin: [
      { group: '考试业务', items: [
        { to: '/', label: '工作台', icon: '🏠' },
        { to: '/exam-management', label: '考试管理', icon: '📋' },
        { to: '/question-bank', label: '智能题库', icon: '📚' },
        { to: '/question-bank-manage', label: '题库管理', icon: '📚' },
        { to: '/tag-management', label: '标签管理', icon: '🏷️' },
        { to: '/ai-question-generator', label: 'AI智能出题', icon: '🤖' },
        { to: '/paper-assembly', label: '智能组卷', icon: '🗂️' },
        { to: '/data-import', label: '数据导入', icon: '📥' },
        { to: '/grading', label: 'AI智能评阅', icon: '✅' },
        { to: '/scan-grading', label: '扫描阅卷', icon: '📄' },
        { to: '/print-management', label: '印刷管理', icon: '🖨️' },
        { to: '/exam-recording', label: '录制回放', icon: '🎥' },
      ] },
      { group: '系统管理', items: [
        { to: '/organization', label: '组织架构', icon: '🏛️' },
        { to: '/system', label: '弹性中台监控', icon: '📊' },
        { to: '/mobile-preview', label: '移动端预览', icon: '📱' },
      ] },
      { group: '教学分析', items: [
        { to: '/exam-analysis', label: '考试分析', icon: '📊' },
        { to: '/assessment-report', label: '考核评估报告', icon: '📈' },
        { to: '/archive-center', label: '归档中心', icon: '📦' },
        { to: '/teacher-dashboard', label: '教师工作台', icon: '📈' },
        { to: '/course-objective', label: '课程目标达成', icon: '🎯' },
        { to: '/knowledge-graph', label: '知识图谱', icon: '🧠' },
      ] },
      { group: '管理大屏', items: [
        { to: '/demo-center', label: '全链路演示中心', icon: '🎬' },
        { to: '/proctor-dashboard', label: '实时监考中心', icon: '👁️' },
        { to: '/command', label: '考试指挥中心', icon: '🖥️' },
        { to: '/command-center', label: '数据大屏', icon: '📺' },
      ] },
      { group: '其他', items: [
        { to: '/live-classroom', label: '直播课堂', icon: '🎥' },
        { to: '/survey', label: '问卷调查', icon: '📋' },
        { to: '/forum', label: '论坛社区', icon: '💬' },
        { to: '/certificate', label: '证书管理', icon: '🏆' },
      ] },
    ],
    proctor: [
      { group: '监考中心', items: [
        { to: '/proctor-dashboard', label: '实时监考中心', icon: '👁️' },
        { to: '/command', label: '考试指挥中心', icon: '🖥️' },
      ] },
    ],
  }

  const logout = async () => {
    const ok = await confirmDialog({ title: '退出登录', message: '确定要退出当前账号吗？', confirmText: '退出', danger: true })
    if (!ok) return
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.dispatchEvent(new Event('auth-changed'))
    toast.info('已安全退出')
    navigate('/login')
  }

  const titleMap = { '/': '工作台', '/portrait': '我的能力画像', '/question-bank': '智能题库',
    '/ai-question-generator': 'AI智能出题', '/adaptive-learning': '自适应学习', '/exam-recording': '考试录制回放',
    '/organization': '组织架构管理', '/question-bank-manage': '题库管理', '/tag-management': '课程标签管理', '/archive-center': '归档中心', '/assessment-report': '课程考核评估报告', '/student-dashboard': '学习仪表盘',
    '/certificate': '电子证书', '/command-center': '考试指挥中心', '/mobile-preview': '移动端预览',
    '/live-classroom': '直播课堂', '/survey': '问卷调查', '/forum': '论坛社区',
    '/knowledge-graph': '知识图谱', '/speaking-test': '口语测评', '/learning-loop': '学习闭环',
    '/wrong-book': '错题本', '/exam-analysis': '考试分析', '/teacher-dashboard': '教师工作台',
    '/course-objective': '课程目标达成', '/ai-grading': 'AI评阅', '/info-collection': '信息采集',
    '/paper-assembly': '智能组卷', '/exam-management': '考试管理', '/data-import': '数据批量导入', '/grading': 'AI 智能评阅', '/scan-grading': '扫描阅卷',
    '/command': '考试指挥中心', '/demo-center': '全链路演示中心', '/system': '弹性中台监控', '/proctor-dashboard': '实时监考中心', '/result': '考试成绩' }
  const exact = titleMap[location.pathname]
  const current = exact || (location.pathname.startsWith('/exam-room') ? '在线考试' : '衡鉴智考')
  const roleLabel = ROLE_META[role]?.label
  const crumbItems = location.pathname.startsWith('/exam-room')
    ? ['考生中心', '在线考试']
    : (roleLabel === current ? [roleLabel] : [roleLabel, current])
  const crumb = crumbItems

  const meta = ROLE_META[role]
  const avatarName = (user.name || user.username || 'U').slice(0, 1)

  return (
    <div className="layout">
      {/* 移动端遮罩 */}
      {sidebarOpen && <div className="sidebar-mask" onClick={() => setSidebarOpen(false)}></div>}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <h2><span className="logo-mark">衡</span>衡鉴智考</h2>
          <p>高校考试能力测评平台</p>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="menu">
          {(menus[role] || []).map((g) => (
            <div key={g.group}>
              <div className="group">{g.group}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setSidebarOpen(false)}>
                  <span className="icon">{it.icon}</span> {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="user-card">
          <span className="avatar">{avatarName}</span>
          <div style={{ display: 'inline-block' }}>
            <div className="nm">{user.name || user.username}</div>
            <div className="small" style={{ color: '#9db8e8' }}>
              {role === 'student' ? `${user.student_no || user.college || '学生'}` : meta?.desc}
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current}</h1>
          </div>
          <div className="flex" style={{ alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div className="global-search" ref={searchRef} style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="全局搜索：考试/题目/试卷/用户/课程..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                onFocus={() => setSearchOpen(true)}
                style={{ width: 120, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f8fafc' }}
              />
              {searching && <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 12, color: '#94a3b8' }}>搜索中...</span>}
              {searchOpen && searchResults && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000, maxHeight: 400, overflowY: 'auto' }}>
                  {Object.entries(searchResults).filter(([k,v]) => v && v.length > 0).map(([type, items]) => (
                    <div key={type} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ padding: '4px 12px', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                        {({exam:'考试',question:'题目',paper:'试卷',user:'用户',course:'课程'})[type] || type} ({items.length})
                      </div>
                      {items.slice(0,5).map((item, i) => (
                        <div key={i} onClick={() => { setSearchOpen(false); setSearchQuery(''); navigate(type === 'exam' ? '/exam-management' : type === 'question' ? '/question-bank' : type === 'paper' ? '/paper-assembly' : '/organization') }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#334155' }} onMouseEnter={(e) => e.target.style.background='#f1f5f9'} onMouseLeave={(e) => e.target.style.background='transparent'}>
                          {item.title || item.content || item.real_name || item.name || '未命名'}
                        </div>
                      ))}
                    </div>
                  ))}
                  {Object.values(searchResults).every(v => !v || v.length === 0) && (
                    <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>未找到相关结果</div>
                  )}
                </div>
              )}
            </div>
            <NotificationCenter />
            <div className="user-chip" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span className="dot">{avatarName}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{user.name || user.username}，你好</span>
            </div>
            <button className="btn sm" onClick={logout}>退出</button>
          </div>
        </div>
        <div className="page"><Outlet /></div>
      </div>
    </div>
  )
}

