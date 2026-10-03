import { useState } from 'react'
import { PageHeader, Tag, toast } from '../components/ui'

const CERTIFICATES = [
  { id: 'CERT202606001', name: '大学英语四级合格证书', student: '张三', student_no: '202401001', score: 528, issue_date: '2026-06-25', status: 'issued', template: '标准模板' },
  { id: 'CERT202606002', name: '高等数学期末考试优秀证书', student: '李四', student_no: '202401002', score: 95, issue_date: '2026-06-28', status: 'issued', template: '优秀模板' },
  { id: 'CERT202606003', name: '计算机基础合格证书', student: '王五', student_no: '202401003', score: 82, issue_date: '2026-06-30', status: 'pending', template: '标准模板' },
  { id: 'CERT202607001', name: '英语口语能力认证', student: '赵六', student_no: '202401004', score: 88, issue_date: '2026-07-05', status: 'issued', template: '认证模板' },
]

const TEMPLATES = [
  { id: 1, name: '标准模板', color: '#3b82f6', description: '蓝白配色，简洁大方' },
  { id: 2, name: '优秀模板', color: '#f59e0b', description: '金色边框，荣誉表彰' },
  { id: 3, name: '认证模板', color: '#8b5cf6', description: '紫色典雅，专业认证' },
  { id: 4, name: '毕业模板', color: '#10b981', description: '绿色清新，学业完成' },
]

export default function Certificate() {
  const [activeTab, setActiveTab] = useState('list') // list / template / verify
  const [selectedCert, setSelectedCert] = useState(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)

  const verifyCertificate = () => {
    if (!verifyCode) { toast.warning('请输入证书编号'); return }
    const cert = CERTIFICATES.find(c => c.id === verifyCode.toUpperCase())
    if (cert) {
      setVerifyResult({ valid: true, cert })
      toast.success('证书验证通过')
    } else {
      setVerifyResult({ valid: false })
      toast.error('未找到该证书')
    }
  }

  return (
    <div>
      <PageHeader
        title="🏆 电子证书生成与管理"
        subtitle="自动生成PDF证书 · 在线验证真伪 · 批量发放 · 模板自定义"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['list', '📋 证书列表'], ['template', '🎨 模板管理'], ['verify', '🔍 在线验证']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#1e40af' : '#6b7280', fontWeight: activeTab === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 统计 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>🏆 累计发放证书</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>3,456</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 已发放</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>3,289</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>⏳ 待发放</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>167</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>🔍 累计验证次数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>12,890</div>
        </div>
      </div>

      {/* 证书列表 */}
      {activeTab === 'list' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 400px', gap: 16 }}>
          <div className="card">
            <div className="card-title">
              <span>📋 证书列表</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm" onClick={() => toast.success('批量发放功能已触发')}>📤 批量发放</button>
                <button className="btn sm primary" onClick={() => toast.success('新增证书对话框已打开')}>+ 新增证书</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>证书编号</th><th>证书名称</th><th>学生</th><th>成绩</th><th>发放日期</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  {CERTIFICATES.map(cert => (
                    <tr key={cert.id} onClick={() => setSelectedCert(cert)} style={{ cursor: 'pointer', background: selectedCert?.id === cert.id ? '#eff6ff' : '' }}>
                      <td className="small muted" style={{ fontFamily: 'monospace' }}>{cert.id}</td>
                      <td><b>{cert.name}</b></td>
                      <td>{cert.student}<br /><span className="small muted">{cert.student_no}</span></td>
                      <td className="num" style={{ fontWeight: 600, color: cert.score >= 90 ? '#10b981' : cert.score >= 60 ? '#3b82f6' : '#ef4444' }}>{cert.score}</td>
                      <td className="small muted">{cert.issue_date}</td>
                      <td><Tag color={cert.status === 'issued' ? 'green' : 'orange'}>{cert.status === 'issued' ? '已发放' : '待发放'}</Tag></td>
                      <td><div className="flex"><button className="btn sm">预览</button><button className="btn sm">下载</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 证书预览 */}
          <div className="card">
            <div className="card-title"><span>👁️ 证书预览</span></div>
            {!selectedCert ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👆</div>
                <div>点击左侧证书查看预览</div>
              </div>
            ) : (
              <div>
                {/* 模拟证书 */}
                <div style={{ padding: 24, background: 'linear-gradient(135deg, #fefce8, #fef9c3)', borderRadius: 12, border: '3px solid #f59e0b', textAlign: 'center', position: 'relative', marginBottom: 16 }}>
                  <div style={{ position: 'absolute', top: 12, right: 12, width: 60, height: 60, borderRadius: '50%', border: '2px solid #dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#dc2626', fontWeight: 700, transform: 'rotate(-15deg)' }}>
                    学校<br />公章
                  </div>
                  <div style={{ fontSize: 12, color: '#92400e', marginBottom: 4 }}>河南衡鉴大学</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#92400e', marginBottom: 16 }}>{selectedCert.name}</div>
                  <div style={{ fontSize: 14, color: '#78350f', marginBottom: 8 }}>兹证明</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>{selectedCert.student}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>学号: {selectedCert.student_no}</div>
                  <div style={{ fontSize: 13, color: '#78350f', marginBottom: 16 }}>
                    在本次考试中取得 <b style={{ fontSize: 18, color: '#dc2626' }}>{selectedCert.score}</b> 分的优异成绩，特发此证，以资鼓励。
                  </div>
                  <div style={{ fontSize: 11, color: '#92400e', fontFamily: 'monospace' }}>证书编号: {selectedCert.id}</div>
                  <div style={{ fontSize: 11, color: '#92400e' }}>发放日期: {selectedCert.issue_date}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn primary" style={{ flex: 1 }} onClick={() => toast.success('证书PDF已下载')}>📥 下载PDF</button>
                  <button className="btn" style={{ flex: 1 }} onClick={() => toast.success('证书链接已复制')}>🔗 分享链接</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 模板管理 */}
      {activeTab === 'template' && (
        <div className="card">
          <div className="card-title"><span>🎨 证书模板管理</span><button className="btn sm primary" onClick={() => toast.success('新增模板对话框已打开')}>+ 新增模板</button></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {TEMPLATES.map(t => (
              <div key={t.id} style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ height: 160, background: `linear-gradient(135deg, ${t.color}15, ${t.color}30)`, borderRadius: 8, border: `2px solid ${t.color}`, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.color }}>证书模板</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{t.name}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>{t.description}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm" style={{ flex: 1 }}>编辑</button>
                  <button className="btn sm" style={{ flex: 1 }}>预览</button>
                  <button className="btn sm" style={{ color: '#ef4444' }}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 在线验证 */}
      {activeTab === 'verify' && (
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="card-title"><span>🔍 证书在线验证</span></div>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <div style={{ fontSize: 16, color: '#6b7280', marginBottom: 20 }}>输入证书编号，验证证书真伪</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input className="input" placeholder="请输入证书编号（如 CERT202606001）" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} style={{ flex: 1, fontFamily: 'monospace' }} />
              <button className="btn primary" onClick={verifyCertificate}>验证</button>
            </div>
            {verifyResult && (
              <div style={{ padding: 20, borderRadius: 10, background: verifyResult.valid ? '#f0fdf4' : '#fef2f2', border: `1px solid ${verifyResult.valid ? '#bbf7d0' : '#fecaca'}` }}>
                {verifyResult.valid ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a', marginBottom: 12 }}>证书验证通过</div>
                    <div style={{ textAlign: 'left', fontSize: 13, color: '#1f2937', lineHeight: 2 }}>
                      <div>证书编号: <b>{verifyResult.cert.id}</b></div>
                      <div>证书名称: <b>{verifyResult.cert.name}</b></div>
                      <div>持证人: <b>{verifyResult.cert.student}</b> ({verifyResult.cert.student_no})</div>
                      <div>成绩: <b>{verifyResult.cert.score}分</b></div>
                      <div>发放日期: <b>{verifyResult.cert.issue_date}</b></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>未找到该证书</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>请检查证书编号是否正确</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
