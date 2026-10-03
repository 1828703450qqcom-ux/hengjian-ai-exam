import { useState, useEffect, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'

/* ============================================================
   全局 Toast 通知（轻量单例，无需 Context）
   用法：import { toast } from '../components/ui'; toast.success('保存成功')
   ============================================================ */
let toastHost = null

function ToastItem({ t, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = document.getElementById(`toast-${t.id}`)
      if (el) el.classList.add('leaving')
      setTimeout(onClose, 260)
    }, t.duration || 3000)
    return () => clearTimeout(timer)
  }, [])
  const icons = { success: '✅', error: '⛔', warning: '⚠️', info: 'ℹ️' }
  return (
    <div id={`toast-${t.id}`} className={`toast ${t.type}`}>
      <span className="toast-icon">{icons[t.type] || 'ℹ️'}</span>
      <div className="toast-body">{t.message}</div>
      <button className="toast-close" onClick={() => { const el = document.getElementById(`toast-${t.id}`); if (el) el.classList.add('leaving'); setTimeout(onClose, 260) }}>✕</button>
    </div>
  )
}

function ToastContainer({ toasts, dismiss }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => <ToastItem key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
    </div>
  )
}

function ToastHost() {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])
  useEffect(() => {
    toastHost = { push: (type, message, duration) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }])
    } }
  }, [])
  return <ToastContainer toasts={toasts} dismiss={dismiss} />
}

export function mountToastHost() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  createRoot(div).render(<ToastHost />)
}

export const toast = {
  success: (m, d) => toastHost?.push('success', m, d),
  error: (m, d) => toastHost?.push('error', m, d),
  warning: (m, d) => toastHost?.push('warning', m, d),
  info: (m, d) => toastHost?.push('info', m, d),
}

/* ============================================================
   Confirm 确认弹窗（Promise 式）
   用法：const ok = await confirmDialog({ title, message, danger })
   ============================================================ */
export function confirmDialog({ title = '确认操作', message = '', confirmText = '确认', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    const close = (val) => { root.unmount(); div.remove(); resolve(val) }
    root.render(
      <div className="modal-mask" onClick={() => close(false)}>
        <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-head"><h3>{title}</h3><button className="close-x" onClick={() => close(false)}>✕</button></div>
          <div className="modal-body" style={{ padding: '20px 22px', color: '#475569', fontSize: 13.5, lineHeight: 1.8 }}>{message}</div>
          <div className="modal-foot">
            <button className="btn" onClick={() => close(false)}>{cancelText}</button>
            <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>{confirmText}</button>
          </div>
        </div>
      </div>
    )
  })
}

/* ============================================================
   Modal 通用弹窗
   ============================================================ */
export function Modal({ open, title, onClose, children, footer, width = 440 }) {
  if (!open) return null
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="close-x" onClick={onClose}>✕</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

/* ============================================================
   Empty 空状态
   ============================================================ */
export function Empty({ icon = '📭', title = '暂无数据', desc = '', action = null }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
      {action}
    </div>
  )
}

/* ============================================================
   Loading / Skeleton 加载态
   ============================================================ */
export function Loading({ text = '加载中...', rows = 0 }) {
  if (rows > 0) return <Skeleton rows={rows} height={40} />
  return <div className="spin-wrap"><div className="spin" /><div className="small">{text}</div></div>
}

export function Skeleton({ rows = 3, height = 16 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, width: i === rows - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

/* ============================================================
   PageHeader 页面头
   ============================================================ */
export function PageHeader({ title, desc, actions = null, crumb = [] }) {
  return (
    <div className="page-header">
      <div>
        {crumb.length > 0 && (
          <div className="crumb" style={{ marginBottom: 6 }}>
            {crumb.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span>›</span>}
                <span className={i === crumb.length - 1 ? '' : ''}><b>{c}</b></span>
              </span>
            ))}
          </div>
        )}
        <div className="ph-title">{title}</div>
        {desc && <div className="ph-desc">{desc}</div>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </div>
  )
}

/* ============================================================
   StatCard 统计卡
   ============================================================ */
export function StatCard({ label, value, delta = null, deltaType = '', icon = null, color = '' }) {
  return (
    <div className="stat">
      {icon && <div className="stat-icon" style={{ background: `${color || 'var(--brand-100)'}22`, fontSize: 18 }}>{icon}</div>}
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className={`delta ${deltaType || ''}`}>{delta}</div>}
    </div>
  )
}

/* ============================================================
   Tag 标签（语义色）
   ============================================================ */
const TAG_MAP = {
  blue: 'blue', green: 'green', orange: 'orange', red: 'red', gray: 'gray', cyan: 'cyan', purple: 'purple',
}
export function Tag({ color = 'gray', dot = false, children }) {
  return <span className={`tag ${TAG_MAP[color] || color}`}>{dot && <span className="dot" />}{children}</span>
}

/* ============================================================
   Progress 进度条
   ============================================================ */
export function Progress({ value, color = '', height = 8 }) {
  return (
    <div className="bar" style={{ height }}>
      <i className={color} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  )
}

/* ============================================================
   Pagination 分页
   ============================================================ */
export function Pagination({ page, total, pageSize = 10, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const list = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) list.push(i)
    else if (list[list.length - 1] !== '...') list.push('...')
  }
  return (
    <div className="pagination">
      <button className="pg disabled" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      {list.map((p, i) => (p === '...' ? <span key={`e${i}`} className="small muted">…</span> : (
        <button key={p} className={`pg ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>{p}</button>
      )))}
      <button className="pg disabled" disabled={page >= pages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  )
}
