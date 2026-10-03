import { useState, useEffect, useRef } from 'react'
import { toast } from './ui'

// 通知类型配置
const NOTIFY_TYPES = {
  exam: { icon: '📝', color: '#3b82f6', label: '考试通知' },
  score: { icon: '📊', color: '#10b981', label: '成绩通知' },
  review: { icon: '⏰', color: '#f59e0b', label: '复习提醒' },
  proctor: { icon: '🚨', color: '#ef4444', label: '监考异常' },
  system: { icon: '🔔', color: '#8b5cf6', label: '系统通知' },
}

export function getNotifications() {
  try {
    return JSON.parse(localStorage.getItem('notifications') || '[]')
  } catch { return [] }
}

export function saveNotifications(list) {
  localStorage.setItem('notifications', JSON.stringify(list))
}

export function addNotification(type, title, content, link = '') {
  const list = getNotifications()
  const item = {
    id: Date.now() + Math.random(),
    type, title, content, link,
    read: false,
    time: new Date().toISOString(),
  }
  list.unshift(item)
  saveNotifications(list.slice(0, 100)) // 最多保留100条
  return item
}

// 检查并生成复习提醒
export function checkReviewReminders() {
  const wrongBook = JSON.parse(localStorage.getItem('wrong_book') || '[]')
  const today = new Date().toISOString().slice(0, 10)
  const dueToday = wrongBook.filter(q => {
    if (q.mastered) return false
    const next = q.review_schedule?.next_review
    return next && next <= today
  })
  if (dueToday.length > 0) {
    // 检查今天是否已经提醒过
    const lastReviewNotify = localStorage.getItem('last_review_notify')
    if (lastReviewNotify !== today) {
      addNotification('review', '今日复习提醒',
        `你有 ${dueToday.length} 道错题今天需要复习，基于艾宾浩斯遗忘曲线，及时复习可提升记忆保留率达90%+`,
        '/wrong-book')
      localStorage.setItem('last_review_notify', today)
    }
  }
}

export default function NotificationCenter() {
  const [list, setList] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    setList(getNotifications())
    checkReviewReminders()
    // 每30秒刷新一次（检查新通知）
    const timer = setInterval(() => setList(getNotifications()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadCount = list.filter(n => !n.read).length

  const markRead = (id) => {
    const updated = list.map(n => n.id === id ? { ...n, read: true } : n)
    setList(updated)
    saveNotifications(updated)
  }

  const markAllRead = () => {
    const updated = list.map(n => ({ ...n, read: true }))
    setList(updated)
    saveNotifications(updated)
    toast.success('已全部标记为已读')
  }

  const removeNotify = (id) => {
    const updated = list.filter(n => n.id !== id)
    setList(updated)
    saveNotifications(updated)
  }

  const clearAll = () => {
    setList([])
    saveNotifications([])
    toast.success('已清空所有通知')
  }

  const handleClick = (n) => {
    markRead(n.id)
    if (n.link) {
      window.location.href = n.link
    }
    setOpen(false)
  }

  const formatTime = (iso) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    return d.toLocaleDateString('zh-CN')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px', borderRadius: 8, fontSize: 18,
        }}
        onMouseEnter={e => e.target.style.background = '#f3f4f6'}
        onMouseLeave={e => e.target.style.background = 'none'}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#ef4444', color: '#fff', fontSize: 10,
            minWidth: 16, height: 16, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, padding: '0 4px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 380, maxWidth: '90vw', background: '#fff',
          borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          border: '1px solid #e5e7eb', zIndex: 9999, overflow: 'hidden',
        }}>
          {/* 头部 */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#fafafa',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
              通知中心 {unreadCount > 0 && <span style={{ color: '#ef4444' }}>({unreadCount}条未读)</span>}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, cursor: 'pointer' }}>
                  全部已读
                </button>
              )}
              {list.length > 0 && (
                <button onClick={clearAll} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                  清空
                </button>
              )}
            </div>
          </div>

          {/* 通知列表 */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {list.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 13 }}>暂无通知</div>
              </div>
            ) : (
              list.map(n => {
                const cfg = NOTIFY_TYPES[n.type] || NOTIFY_TYPES.system
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid #f9fafb',
                      cursor: 'pointer', background: n.read ? '#fff' : '#f0f9ff',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : '#f0f9ff'}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: cfg.color + '15', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: '#1f2937' }}>
                          {n.title}
                        </span>
                        <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>
                          {formatTime(n.time)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 4 }}>
                        {n.content}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeNotify(n.id) }}
                          style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: 14, cursor: 'pointer', padding: '2px 6px' }}
                          onMouseEnter={e => e.target.style.color = '#ef4444'}
                          onMouseLeave={e => e.target.style.color = '#d1d5db'}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* 底部 */}
          {list.length > 0 && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f3f4f6', textAlign: 'center', background: '#fafafa' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>共 {list.length} 条通知 · 最多保留100条</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
