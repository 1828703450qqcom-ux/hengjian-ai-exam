import { useState } from 'react'
import { PageHeader, Tag } from '../components/ui'

export default function MobilePreview() {
  const [activePage, setActivePage] = useState('home')
  const [device, setDevice] = useState('phone') // phone / tablet

  const pages = [
    { key: 'home', label: '首页', icon: '🏠' },
    { key: 'exam', label: '考试', icon: '📝' },
    { key: 'score', label: '成绩', icon: '📊' },
    { key: 'wrong', label: '错题', icon: '❌' },
    { key: 'me', label: '我的', icon: '👤' },
  ]

  return (
    <div>
      <PageHeader
        title="📱 移动端适配预览"
        subtitle="响应式布局 · 移动端优化 · 手机/平板自适应"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['phone', '📱 手机'], ['tablet', '📱 平板']].map(([key, label]) => (
              <button key={key} onClick={() => setDevice(key)}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: device === key ? '#fff' : 'transparent', color: device === key ? '#1e40af' : '#6b7280', fontWeight: device === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'center', gap: 40, padding: 20 }}>
        {/* 手机模拟器 */}
        <div style={{ width: device === 'phone' ? 375 : 768, height: device === 'phone' ? 667 : 1024, background: '#1a1a2e', borderRadius: device === 'phone' ? 40 : 20, padding: device === 'phone' ? 12 : 20, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ width: '100%', height: '100%', background: '#f8fafc', borderRadius: device === 'phone' ? 30 : 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* 状态栏 */}
            <div style={{ padding: '8px 16px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#1f2937', borderBottom: '1px solid #e5e7eb' }}>
              <span>9:41</span>
              <span>📶 🔋 100%</span>
            </div>

            {/* 页面内容 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {activePage === 'home' && (
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>你好，张三 👋</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>今天也要加油学习哦！</div>
                  <div style={{ padding: 16, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 12, color: '#fff', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>即将开始</div>
                    <div style={{ fontSize: 16, fontWeight: 600, margin: '4px 0' }}>大学英语期末考试</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>明天 09:00 · 120分钟</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[['📝', '我的考试', '3场'], ['📊', '成绩查询', '87.5分'], ['❌', '错题本', '23题'], ['📚', '练习题库', '128题']].map(([icon, label, value], i) => (
                      <div key={i} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>学习进度</div>
                  <div style={{ padding: 12, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12 }}>本周学习目标</span>
                      <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>68%</span>
                    </div>
                    <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '68%', height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              )}

              {activePage === 'exam' && (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>我的考试</div>
                  {[
                    { name: '大学英语期末考试', time: '明天 09:00', status: 'upcoming', color: '#3b82f6' },
                    { name: '高等数学期中考试', time: '已结束', status: 'finished', score: 85, color: '#10b981' },
                    { name: '计算机基础测验', time: '进行中', status: 'ongoing', color: '#f59e0b' },
                  ].map((exam, i) => (
                    <div key={i} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 10, borderLeft: `4px solid ${exam.color}` }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{exam.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{exam.time}</div>
                      {exam.score && <div style={{ fontSize: 16, fontWeight: 700, color: exam.color, marginTop: 4 }}>{exam.score}分</div>}
                      {exam.status === 'ongoing' && <button style={{ marginTop: 8, padding: '6px 16px', background: exam.color, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }}>进入考试</button>}
                    </div>
                  ))}
                </div>
              )}

              {activePage === 'score' && (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>我的成绩</div>
                  <div style={{ padding: 20, background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: 12, color: '#fff', textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>综合评分</div>
                    <div style={{ fontSize: 40, fontWeight: 700 }}>87.5</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>班级排名 第5名 · 年级排名 第28名</div>
                  </div>
                  {['大学英语', '高等数学', '计算机基础', '大学物理'].map((course, i) => (
                    <div key={i} style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>{course}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i] }}>{[88, 92, 85, 79][i]}</span>
                    </div>
                  ))}
                </div>
              )}

              {activePage === 'wrong' && (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>我的错题本</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {['全部', '英语', '数学', '计算机'].map((tag, i) => (
                      <span key={i} style={{ padding: '4px 12px', background: i === 0 ? '#3b82f6' : '#f1f5f9', color: i === 0 ? '#fff' : '#6b7280', borderRadius: 12, fontSize: 11 }}>{tag}</span>
                    ))}
                  </div>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>单选题 · 词汇辨析</div>
                      <div style={{ fontSize: 13, marginBottom: 8 }}>The scientist was _____ by the unexpected results.</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', background: '#fef2f2', color: '#ef4444', borderRadius: 4 }}>你的答案: A</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', background: '#f0fdf4', color: '#10b981', borderRadius: 4 }}>正确答案: B</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activePage === 'me' && (
                <div>
                  <div style={{ padding: 20, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 12, color: '#fff', textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👨‍🎓</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>张三</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>软工2401班 · 202401001</div>
                  </div>
                  {[['📝', '我的考试', '3场'], ['📊', '成绩报告', '查看'], ['🏆', '我的证书', '5张'], ['⚙️', '设置', ''], ['❓', '帮助中心', '']].map(([icon, label, value], i) => (
                    <div key={i} style={{ padding: 14, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{icon}</span>
                        <span style={{ fontSize: 14 }}>{label}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{value} ›</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部导航 */}
            <div style={{ display: 'flex', background: '#fff', borderTop: '1px solid #e5e7eb', padding: '8px 0' }}>
              {pages.map(p => (
                <button key={p.key} onClick={() => setActivePage(p.key)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <span style={{ fontSize: 10, color: activePage === p.key ? '#3b82f6' : '#6b7280', fontWeight: activePage === p.key ? 600 : 400 }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 适配说明 */}
        <div style={{ width: 320 }}>
          <div className="card">
            <div className="card-title"><span>📱 移动端适配说明</span></div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>✅ 已完成适配</div>
                <div>• 响应式布局（手机/平板/桌面）</div>
                <div>• 触控友好的按钮尺寸（≥44px）</div>
                <div>• 移动端底部导航栏</div>
                <div>• 卡片式内容展示</div>
                <div>• 下拉刷新与上拉加载</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>📱 支持设备</div>
                <div>• 手机：375×667 / 390×844</div>
                <div>• 平板：768×1024 / 1024×1366</div>
                <div>• 桌面：1280×720 及以上</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>🔧 技术方案</div>
                <div>• CSS Media Queries 响应式</div>
                <div>• Flexbox / Grid 弹性布局</div>
                <div>• 相对单位（rem/vw）</div>
                <div>• 移动端优先设计</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
