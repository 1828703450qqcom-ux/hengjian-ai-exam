import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './command-center.css'
import './command-center-v2.css'

function PlatformArt() {
  return <svg className="cc-platform-art" viewBox="0 0 450 220" fill="none" role="img" aria-label="智慧考试平台矢量插图">
    <defs>
      <linearGradient id="platformTop" x1="108" y1="30" x2="332" y2="177" gradientUnits="userSpaceOnUse"><stop stopColor="#d0f9ff" /><stop offset=".42" stopColor="#65c6ff" /><stop offset="1" stopColor="#1266ff" /></linearGradient>
      <linearGradient id="platformSide" x1="146" y1="120" x2="285" y2="206" gradientUnits="userSpaceOnUse"><stop stopColor="#179cfa" /><stop offset="1" stopColor="#0b36b2" /></linearGradient>
      <filter id="platformGlow"><feGaussianBlur stdDeviation="5" /></filter>
    </defs>
    <ellipse cx="225" cy="181" rx="174" ry="32" stroke="#16c9ff" strokeWidth="3" opacity=".8" />
    <ellipse cx="225" cy="181" rx="143" ry="24" stroke="#168cff" strokeWidth="2" opacity=".65" />
    <ellipse cx="225" cy="181" rx="174" ry="32" stroke="#00caff" strokeWidth="7" opacity=".45" filter="url(#platformGlow)" />
    <path d="m111 149 114-42 114 42-114 43-114-43Z" fill="#1260d7" stroke="#49bbff" strokeWidth="3" />
    <path d="m111 149 114 43v17l-114-43v-17Z" fill="#0d3c9c" stroke="#258ef8" />
    <path d="m339 149-114 43v17l114-43v-17Z" fill="url(#platformSide)" stroke="#258ef8" />
    <path d="m132 115 93-36 93 36-93 36-93-36Z" fill="#56b7ff" stroke="#c3f7ff" strokeWidth="3" />
    <path d="m132 115 93 36v21l-93-36v-21Z" fill="#1674d6" stroke="#70d8ff" />
    <path d="m318 115-93 36v21l93-36v-21Z" fill="#0e58ca" stroke="#70d8ff" />
    <path d="m145 70 80-30 80 30-80 31-80-31Z" fill="url(#platformTop)" stroke="#d7fdff" strokeWidth="3" />
    <path d="m145 70 80 31v22l-80-32V70Z" fill="#2c8def" stroke="#9deaff" />
    <path d="m305 70-80 31v22l80-32V70Z" fill="#1563dc" stroke="#9deaff" />
    <path d="M80 74v66M370 71v68M105 40v24M345 40v24" stroke="#1ed1ff" strokeWidth="2" opacity=".75" />
    <circle cx="80" cy="74" r="4" fill="#e5ffff" /><circle cx="370" cy="71" r="4" fill="#e5ffff" />
    <path d="M60 38h22M60 38v17M390 39h-22M390 39v17M225 18v12" stroke="#30aaff" strokeWidth="2" />
    <circle cx="225" cy="20" r="3" fill="#d5ffff" />
  </svg>
}

function TechIcon({ type }) {
  const paths = {
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="m12 12 9-9M18 3h3v3" /></>,
    bars: <><path d="M4 20V11M10 20V5M16 20V8M22 20V3" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Z" /><circle cx="18" cy="9" r="2" /><path d="M17 15a4 4 0 0 1 4 4" /></>,
    check: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 12 3 3 7-7" /></>,
    alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
    sheet: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4M8 11h8M8 15h8" /></>,
    trend: <><path d="M3 18 9 12l4 3 8-9" /><path d="M16 6h5v5" /></>,
    bell: <><path d="M6 17h12l-2-3V9a4 4 0 0 0-8 0v5l-2 3Z" /><path d="M10 20h4" /></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  }
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>
}

const exams = [
  { name: '大学英语期末考试', course: '大学英语', total: 1256, status: '进行中', statusColor: 'blue', submitted: 892, anomalies: 5 },
  { name: '高等数学期末考试', course: '高等数学', total: 980, status: '待开始', statusColor: 'orange', submitted: 0, anomalies: 0 },
  { name: '计算机基础考试', course: '计算机基础', total: 1560, status: '已结束', statusColor: 'green', submitted: 1560, anomalies: 12 },
]

const stats = [
  { label: '进行中考试', value: '3', unit: '场', color: 'blue', icon: 'bars', to: '/exam-management' },
  { label: '当前在考人数', value: '2,156', unit: '人', color: 'teal', icon: 'users', to: '/proctor-dashboard' },
  { label: '已交卷人数', value: '2,452', unit: '人', color: 'purple', icon: 'check', to: '/exam-analysis' },
  { label: '异常预警', value: '22', unit: '起', color: 'red', icon: 'alert', to: '/proctor-dashboard' },
]

const alerts = [
  { type: '人脸消失', exam: '大学英语 · 张三', time: '14:32:15', level: 'orange' },
  { type: '切屏异常', exam: '计算机基础 · 李四', time: '14:28:07', level: 'blue' },
  { type: '多人出现', exam: '大学英语 · 王五', time: '14:25:44', level: 'red' },
  { type: '声音异常', exam: '高等数学 · 赵六', time: '14:20:33', level: 'orange' },
]

export default function CommandCenter() {
  const [now, setNow] = useState(new Date())
  const [trendMode, setTrendMode] = useState('submitted')
  const navigate = useNavigate()
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  })()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const trendValues = trendMode === 'submitted' ? [0, 70, 160, 310, 490, 740, 892] : [1120, 1100, 1070, 1040, 1010, 960, 920]
  const trendPoints = trendValues.map((value, index) => [20 + index * 78, 225 - value / 1200 * 205])
  const trendLine = trendPoints.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ')

  return (
    <div className="cc-page">
      {/* 面包屑导航 */}
      <div className="cc-breadcrumb">
        <span>管理工作台</span>
        <span className="separator">›</span>
        <b>工作台</b>
        <h1>衡鉴智考 · 考试指挥中心</h1>
      </div>

      {/* 顶部横幅 */}
      <div className="cc-hero">
        <div className="hero-left">
          <div className="hero-icon"><TechIcon type="target" /></div>
          <div className="hero-text">
            <h2>考试指挥中心</h2>
            <p>实时监控 · 全局态势 · 异常预警 · 智能调度</p>
            <span className="hero-eyebrow">AI DRIVEN &nbsp;·&nbsp; SMART EXAM &nbsp;·&nbsp; REAL-TIME MONITORING</span>
          </div>
        </div>
        <div className="hero-motto">更安全 <span>更智能</span> <span>更高效</span></div>
        <PlatformArt />
        <div className="hero-right">
          <div className="hero-clock">
            <small>{now.getFullYear()}.{String(now.getMonth() + 1).padStart(2, '0')}.{String(now.getDate()).padStart(2, '0')} &nbsp; {['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]}</small>
            <b>{now.toLocaleTimeString('zh-CN', { hour12: false })}</b>
            <span>● &nbsp;系统运行正常</span>
          </div>
        </div>
      </div>

      <div className="cc-demo-note"><span className="demo-status-dot" />演示数据 · 接入实际考试及监考服务后显示实时数据</div>

      {/* 核心指标卡片 */}
      <div className="cc-stats">
        {stats.map((stat, index) => (
          <button type="button" className={`cc-stat ${stat.color}`} key={index} onClick={() => navigate(stat.to)}>
            <div className="stat-icon"><TechIcon type={stat.icon} /></div>
            <div className="stat-content">
              <span className="stat-label">{stat.label}</span>
              <strong className="stat-value">
                {stat.value}<em>{stat.unit}</em>
              </strong>
            </div>
            <div className="stat-arrow">›</div>
          </button>
        ))}
      </div>

      {/* 上半部分网格 */}
      <div className="cc-grid top-grid">
        {/* 正在进行的考试 */}
        <section className="cc-card exams">
          <header>
            <h3><TechIcon type="sheet" />正在进行的考试</h3>
            <label className="badge">3场</label>
          </header>
          <div className="exam-list">
            {exams.map((exam, index) => (
              <div className="exam-row" key={index}>
                <div className="exam-head">
                  <b>{exam.name}</b>
                  <span className={`status ${exam.statusColor}`}>{exam.status}</span>
                </div>
                <div className="exam-meta">{exam.course} · {exam.total}人</div>
                <div className="exam-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(exam.submitted / exam.total) * 100}%` }} />
                  </div>
                  <span className="progress-text">{exam.submitted}/{exam.total}</span>
                  <button className="detail-btn" onClick={() => navigate('/exam-management')} aria-label={`查看${exam.name}详情`}>详情</button>
                </div>
                {exam.anomalies > 0 && (
                  <div className="exam-anomaly">⚠ {exam.anomalies}起异常</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 交卷人数趋势 */}
        <section className="cc-card trend">
          <header>
            <h3><TechIcon type="trend" />交卷人数趋势</h3>
            <div className="tabs">
              <button type="button" className={trendMode === 'submitted' ? 'active' : ''} onClick={() => setTrendMode('submitted')}>交卷人数</button>
              <button type="button" className={trendMode === 'present' ? 'active' : ''} onClick={() => setTrendMode('present')}>在考人数</button>
            </div>
          </header>
          <div className="line-chart">
            <svg viewBox="0 0 500 260" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x2="0" y2="1">
                  <stop stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="1" stopColor="#3b82f6" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path d={`${trendLine} L488 225Z`} fill="url(#chartGradient)" />
              <path d={trendLine} fill="none" stroke="#3b82f6" strokeWidth="3" />
              {trendPoints.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="4" fill="#51d5ff" stroke="#1376f7" strokeWidth="2" />)}
            </svg>
            <div className="chart-labels">
              <span>14:00</span><span>14:15</span><span>14:30</span>
              <span>14:45</span><span>15:00</span><span>15:15</span><span>15:30</span>
            </div>
            <div className="chart-callout">15:30<br /><b>{trendValues[6].toLocaleString()}人</b></div>
          </div>
        </section>

        {/* 异常情况分布 */}
        <section className="cc-card donut">
          <header>
            <h3><TechIcon type="target" />异常情况分布</h3>
            <select><option>近一小时</option></select>
          </header>
          <div className="donut-wrap">
            <div className="donut-ring">
              <div>
                <b>22</b>
                <span>异常总数</span>
              </div>
            </div>
            <div className="donut-labels">
              <div className="donut-label l1"><span className="dot" />人脸消失 <b>(8, 36%)</b></div>
              <div className="donut-label l2"><span className="dot" />切屏 <b>(5, 23%)</b></div>
              <div className="donut-label l3"><span className="dot" />多人出现 <b>(3, 14%)</b></div>
              <div className="donut-label l4"><span className="dot" />声音异常 <b>(4, 18%)</b></div>
              <div className="donut-label l5"><span className="dot" />其他 <b>(2, 9%)</b></div>
            </div>
          </div>
        </section>
      </div>

      {/* 下半部分网格 */}
      <div className="cc-grid bottom-grid">
        {/* 实时预警信息 */}
        <section className="cc-card alerts">
          <header>
            <h3><TechIcon type="bell" />实时预警信息</h3>
            <button className="view-all" onClick={() => navigate('/proctor-dashboard')}>查看全部 ›</button>
          </header>
          <div className="alert-list">
            {alerts.map((alert, index) => (
              <div className="alert-row" key={index}>
                <div className={`alert-indicator ${alert.level}`} />
                <div className="alert-content">
                  <b>{alert.type}</b>
                  <span>{alert.exam}</span>
                </div>
                <time>{alert.time}</time>
              </div>
            ))}
          </div>
        </section>

        {/* 考场实时监控 */}
        <section className="cc-card cameras">
          <header>
            <h3><TechIcon type="monitor" />考场实时监控</h3>
            <button className="view-all" onClick={() => navigate('/proctor-dashboard')}>查看全部 ›</button>
          </header>
          <div className="camera-grid">
            {[1, 2, 3, 4].map(i => (
              <div className="camera" key={i}>
                <div className="cam-title">考场{i}<span className="expand-icon">⛶</span></div>
                <div className="room-preview">
                  <div className="room-window" />
                  <div className="room-desk d1" />
                  <div className="room-desk d2" />
                  <div className="room-desk d3" />
                </div>
                <small className="online-status">● 在线</small>
              </div>
            ))}
          </div>
        </section>

        {/* 系统资源使用 */}
        <section className="cc-card resources">
          <header>
            <h3><TechIcon type="bars" />系统资源使用</h3>
            <button className="view-all" onClick={() => navigate(user?.role === 'admin' ? '/system' : '/exam-analysis')}>更多监控 ›</button>
          </header>
          <div className="resource-list">
            {[
              { name: 'CPU使用率', value: 45, color: 'blue' },
              { name: '内存使用率', value: 62, color: 'purple' },
              { name: '磁盘使用率', value: 38, color: 'teal' },
              { name: '网络带宽', value: 72, color: 'orange' },
            ].map((res, index) => (
              <div className="res-row" key={index}>
                <div className="res-info">
                  <span>{res.name}</span>
                  <b>{res.value}%</b>
                </div>
                <div className="res-bar">
                  <div className={`res-fill ${res.color}`} style={{ width: `${res.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
