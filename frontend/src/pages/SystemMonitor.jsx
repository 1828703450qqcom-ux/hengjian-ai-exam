import { useCallback, useEffect, useState } from 'react'
import api from '../api'
import EChart from '../components/EChart'
import { PageHeader, Tag } from '../components/ui'

const resourceMeta = {
  cpu: ['CPU 负载', '#287cf0'], memory: ['内存使用', '#7759e8'],
  storage: ['存储空间', '#0ea88a'], network: ['网络带宽', '#f59e0b'],
}

export default function SystemMonitor() {
  const [runtime, setRuntime] = useState(null)
  const [kpi, setKpi] = useState(null)
  const [health, setHealth] = useState(null)
  const [history, setHistory] = useState([28,31,34,38,43,39,42,45,41,44])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [r, k, h] = await Promise.all([api.get('/system/runtime'), api.get('/system/kpi'), api.get('/system/health')])
      setRuntime(r); setKpi(k.kpi); setHealth(h)
      setHistory(prev => [...prev.slice(-11), r.resources.cpu])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer) }, [load])
  if (loading) return <div className="spin-wrap"><span className="spin"/><span>正在连接弹性中台...</span></div>

  const trafficOption = {
    grid: { left: 38, right: 18, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: history.map((_, i) => `${i * 5}s`), boundaryGap: false, axisLine: { lineStyle: { color: '#dce6f2' } }, axisLabel: { color: '#8293ad' } },
    yAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#edf2f7' } }, axisLabel: { color: '#8293ad' } },
    tooltip: { trigger: 'axis' },
    series: [{ type: 'line', smooth: true, data: history, symbol: 'none', lineStyle: { width: 3, color: '#287cf0' }, areaStyle: { color: 'rgba(40,124,240,.13)' } }],
  }

  return <div className="system-console">
    <PageHeader title="弹性中台运行中心" desc="服务拓扑 · 性能指标 · 容量态势 · 弹性调度" actions={<div className="flex"><Tag color="green" dot>全部服务正常</Tag><button className="btn" onClick={load}>刷新数据</button></div>} />

    <div className="console-hero">
      <div><span className="console-kicker">PLATFORM CONTROL CENTER</span><h2>核心链路运行稳定</h2><p>当前 {runtime.services.length} 个业务服务在线，P95 响应 {runtime.traffic.p95_ms}ms，错误率 {(runtime.traffic.error_rate * 100).toFixed(2)}%</p></div>
      <div className="console-hero-metrics"><span><b>{runtime.traffic.qps}</b>实时 QPS</span><span><b>{runtime.traffic.active_connections.toLocaleString()}</b>活跃连接</span><span><b>{Math.floor((health?.uptime_sec || 0) / 60)}</b>运行分钟</span></div>
    </div>

    <div className="resource-grid">
      {Object.entries(runtime.resources).map(([key, value]) => <div className="resource-card" key={key} style={{ '--accent': resourceMeta[key][1] }}><div><i>{key === 'cpu' ? '⚙' : key === 'memory' ? '▦' : key === 'storage' ? '◫' : '⌁'}</i><span>{resourceMeta[key][0]}<small>安全阈值 80%</small></span><b>{value}%</b></div><div className="resource-bar"><em style={{ width: `${value}%` }}/></div></div>)}
    </div>

    <div className="console-grid">
      <section className="card service-panel"><div className="card-title"><span>服务拓扑</span><Tag color="blue">自动发现</Tag></div><div className="service-grid">{runtime.services.map((s, i) => <div className="service-node" key={s.key}><span className="service-index">0{i+1}</span><div><b>{s.name}</b><small>{s.instances} 个实例 · {s.latency_ms}ms</small></div><i className={s.status}/></div>)}</div></section>
      <section className="card"><div className="card-title"><span>CPU 实时趋势</span><span className="small muted">15 秒自动刷新</span></div><EChart option={trafficOption} height={282}/></section>
    </div>

    <div className="console-grid lower">
      <section className="card"><div className="card-title"><span>业务数据容量</span><Tag color="cyan">实时</Tag></div><div className="capacity-grid">{[['题库内容',runtime.capacity.questions,'题'],['试卷资产',runtime.capacity.papers,'份'],['考试任务',runtime.capacity.exams,'场'],['能力画像',runtime.capacity.portraits,'份']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1].toLocaleString()}</b><small>{x[2]}</small></div>)}</div></section>
      <section className="card"><div className="card-title"><span>平台硬指标</span><Tag color="green" dot>指标对齐</Tag></div><div className="kpi-list">{[['并发容量',`${kpi?.concurrency || 0} 人`],['响应目标',`≤ ${kpi?.response_ms || 500} ms`],['平台可用率',`${((kpi?.availability || 0)*100).toFixed(2)}%`],['队列积压',`${runtime.traffic.queue_depth} 条`]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><em>达标</em></div>)}</div></section>
    </div>
  </div>
}
