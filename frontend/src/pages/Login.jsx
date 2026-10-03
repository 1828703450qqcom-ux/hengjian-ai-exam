import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { toast } from '../components/ui'

const DEMO = [
  ['学生', 'stu01', '123456'],
  ['教师', 'teacher', 'teacher123'],
  ['管理员', 'admin', 'admin123'],
]

const FEATURES = [
  ['👁️', '多模态监考', '人脸 · 行为 · 语音 · 活体，证据链可追溯'],
  ['✍️', 'AI 智能评阅', '客观题 100% · 主观题一致性 ≥90% · 口语 ≥92%'],
  ['🧭', '能力画像', '≥50 维知识图谱画像，输出个性化学习建议'],
  ['📊', '管理大屏', '考试指挥 · 扫描阅卷 · 弹性中台 KPI 监控'],
]

const STATS = [
  { value: '99%', label: '活体识别准确率' },
  { value: '95%', label: '作弊识别率' },
  { value: '≤2s', label: '预警响应时间' },
  { value: '50+', label: '能力画像维度' },
]

export default function Login() {
  const [username, setUsername] = useState('stu01')
  const [password, setPassword] = useState('123456')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState('')
  const navigate = useNavigate()

  const login = async (u = username, p = password) => {
    setLoading(true); setErr('')
    try {
      const data = await api.post('/auth/login', { username: u, password: p })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      window.dispatchEvent(new Event('auth-changed'))
      toast.success(`欢迎回来，${data.user.name}`)
      navigate('/')
    } catch (e) {
      setErr(e.detail || '登录失败')
      toast.error(e.detail || '登录失败')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-wrap-v2">
      {/* 左侧品牌区 */}
      <div className="login-side-v2">
        {/* 动态背景装饰 */}
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="bg-orb orb-3" />
        <div className="bg-grid" />
        <img className="login-illustration" src="/illustrations/data-orbit.svg" alt="智慧考试数据插图" />

        <div className="side-content">
          <div className="brand-row">
            <div className="brand-logo">鼎</div>
            <div>
              <div className="brand-name">衡鉴智考</div>
              <div className="brand-tag">高校考试能力测评平台</div>
            </div>
          </div>

          <h1 className="hero-title">
            会看 · 会听 · 会评<br />
            <span className="gradient-text">能画像</span>的智慧考试系统
          </h1>

          <p className="hero-sub">
            将考试从"单纯判分数"升级为"测评能力"，多模态采集 + AI 评阅 + 知识图谱画像，
            每一项能力均设置可量化 KPI 硬指标，输出带证据链的能力诊断结果。
          </p>

          {/* 数据统计 */}
          <div className="stats-row">
            {STATS.map((s) => (
              <div className="stat-item" key={s.label}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 特性卡片 */}
          <div className="feature-grid-v2">
            {FEATURES.map(([icon, t, d]) => (
              <div className="feature-card" key={t}>
                <div className="feature-icon">{icon}</div>
                <div className="feature-text">
                  <b>{t}</b>
                  <span>{d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="side-footer">© 2026 衡鉴智考 · 高校智能考试平台 v1.0</div>
      </div>

      {/* 右侧登录区 */}
      <div className="login-right-v2">
        <div className="login-card-v2">
          <div className="lc-header">
            <div className="lc-avatar">鼎</div>
            <h2>欢迎登录</h2>
            <p>登录您的账号，开启智慧考试之旅</p>
          </div>

          <div className="form-group">
            <label className={focused === 'user' ? 'label-active' : ''}>账号</label>
            <div className={`input-wrap ${focused === 'user' ? 'input-focus' : ''}`}>
              <span className="input-icon">👤</span>
              <input
                className="input-v2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入账号"
                onFocus={() => setFocused('user')}
                onBlur={() => setFocused('')}
              />
            </div>
          </div>

          <div className="form-group">
            <label className={focused === 'pass' ? 'label-active' : ''}>密码</label>
            <div className={`input-wrap ${focused === 'pass' ? 'input-focus' : ''}`}>
              <span className="input-icon">🔒</span>
              <input
                className="input-v2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                onFocus={() => setFocused('pass')}
                onBlur={() => setFocused('')}
                onKeyDown={(e) => e.key === 'Enter' && login()}
              />
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-wrap">
              <input type="checkbox" defaultChecked />
              <span className="checkbox-custom" />
              记住我
            </label>
            <a className="forgot-link">忘记密码？</a>
          </div>

          {err && <div className="alert danger mb16">{err}</div>}

          <button className="btn-login-v2" disabled={loading} onClick={() => login()}>
            {loading ? (
              <><span className="spin" /> 登录中...</>
            ) : (
              <>登 录 <span className="btn-arrow">→</span></>
            )}
          </button>

          <div className="divider"><span>演示账号</span></div>

          <div className="demo-buttons">
            {DEMO.map(([r, u, p]) => (
              <button key={u} className="demo-btn" onClick={() => login(u, p)}>
                <span className="demo-role">{r}</span>
                <span className="demo-user">{u}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="login-copyright-v2">© 2026 衡鉴智考 · 保留所有权利</div>
      </div>
    </div>
  )
}
