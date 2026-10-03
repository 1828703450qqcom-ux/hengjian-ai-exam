import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './command-center.css'

const exams = [
  { name: '大学英语期末考试', course: '大学英语', total: 1256, status: '进行中', statusColor: 'blue', submitted: 892, anomalies: 5 },
  { name: '高等数学期末考试', course: '高等数学', total: 980, status: '待开始', statusColor: 'orange', submitted: 0, anomalies: 0 },
  { name: '计算机基础考试', course: '计算机基础', total: 1560, status: '已结束', statusColor: 'green', submitted: 1560, anomalies: 12 },
]

const stats = [
  { label: '进行中考试', value: '3', unit: '场', color: 'blue', icon: '📊' },
  { label: '当前在考人数', value: '2,156', unit: '人', color: 'teal', icon: '👥' },
  { label: '已交卷人数', value: '2,452', unit: '人', color: 'purple', icon: '✅' },
  { label: '异常预警', value: '22', unit: '起', color: 'red', icon: '⚠️' },
]

const alerts = [
  { type: '人脸消失', exam: '大学英语 · 张三', time: '14:32:15', level: 'orange' },
  { type: '切屏异常', exam: '计算机基础 · 李四', time: '14:28:07', level: 'blue' },
  { type: '多人出现', exam: '大学英语 · 王五', time: '14:25:44', level: 'red' },
  { type: '声音异常', exam: '高等数学 · 赵六', time: '14:20:33', level: 'orange' },
]

export default function CommandCenter() {
  const [now, setNow] = useState(new Date())
  const navigate = useNavigate()
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  })()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatDate = (date) => {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
  }

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
          <div className="hero-icon">🎯</div>
          <div className="hero-text">
            <span className="hero-eyebrow">衡鉴智考 · 高校考试能力测评平台</span>
            <h2>让每场考试，都成为能力成长的起点</h2>
            <p>贯通题库、组卷、考试、监考、评阅与学情分析，帮助学校在统一工作台中管理考试全流程。</p>
            <div className="hero-capabilities" aria-label="平台核心能力">
              <span>智能题库与组卷</span><span>线上考试与多模态监考</span><span>AI辅助评阅</span><span>知识图谱与能力诊断</span>
            </div>
          </div>
        </div>
        <img className="hero-illustration" src="/illustrations/exam-platform.svg" alt="智慧考试平台插图" />
        <div className="hero-right">
          <div className="hero-clock">
            <b>{now.toLocaleTimeString('zh-CN', { hour12: false })}</b>
            <span>{formatDate(now)}</span>
          </div>
        </div>
      </div>

      <div className="cc-demo-note"><span className="demo-status-dot" />当前页面展示演示数据与界面流程；接入实际教务、考试及监考服务后，方可显示对应实时数据。</div>

      {/* 核心指标卡片 */}
      <div className="cc-stats">
        {stats.map((stat, index) => (
          <div className={`cc-stat ${stat.color}`} key={index}>
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-content">
              <span className="stat-label">{stat.label}</span>
              <strong className="stat-value">
                {stat.value}<em>{stat.unit}</em>
              </strong>
            </div>
            <div className="stat-arrow">›</div>
          </div>
        ))}
      </div>

      {/* 上半部分网格 */}
      <div className="cc-grid top-grid">
        {/* 正在进行的考试 */}
        <section className="cc-card exams">
          <header>
            <h3>📋 正在进行的考试</h3>
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
            <h3>📈 交卷人数趋势</h3>
            <div className="tabs">
              <b className="active">交卷人数</b>
              <span>在考人数</span>
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
              <path d="M20 225 C80 220 100 205 145 194 S210 160 245 145 S300 110 340 85 S400 65 435 40 S475 25 490 18 L490 225Z" fill="url(#chartGradient)" />
              <path d="M20 225 C80 220 100 205 145 194 S210 160 245 145 S300 110 340 85 S400 65 435 40 S475 25 490 18" fill="none" stroke="#3b82f6" strokeWidth="3" />
            </svg>
            <div className="chart-labels">
              <span>14:00</span><span>14:15</span><span>14:30</span>
              <span>14:45</span><span>15:00</span><span>15:15</span><span>15:30</span>
            </div>
            <div className="chart-callout">15:30<br /><b>892人</b></div>
          </div>
        </section>

        {/* 异常情况分布 */}
        <section className="cc-card donut">
          <header>
            <h3>🎯 异常情况分布</h3>
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
            <h3>🔔 实时预警信息</h3>
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
            <h3>📹 考场实时监控</h3>
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
            <h3>💻 系统资源使用</h3>
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
