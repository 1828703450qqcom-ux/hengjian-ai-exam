import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const roles = [
  ['校级管理员','全局配置、组织与数据治理','🏛️','#6366f1'],
  ['院系管理员','院系考试、题库与报表','🏫','#0ea5e9'],
  ['教师','出题组卷、评阅与分析','🧑‍🏫','#14b8a6'],
  ['监考员','实时监考、告警处置','👁️','#f59e0b'],
  ['学生','多端作答、成绩与画像','🎓','#ec4899'],
]
const bank = ['题目资源层','知识点层','能力维度层','试卷资源层']
const paper = ['答题卡制作','印刷管理','高速扫卷','流水阅卷']
const links = [
  ['题库与组卷','/question-bank','📚'], ['试卷审核','/paper-assembly','🗂️'], ['在线监考','/proctor-dashboard','👁️'],
  ['AI智能评阅','/ai-grading','✍️'], ['统计分析','/exam-analysis','📊'], ['知识图谱','/knowledge-graph','🧠'],
  ['课程目标达成','/course-objective','🎯'], ['能力画像','/portrait','🧭'], ['智慧指挥中心','/command-center','🖥️'],
]

export default function DemoCenter() {
  const navigate = useNavigate()
  const [bankStep, setBankStep] = useState(0)
  const [paperStep, setPaperStep] = useState(0)
  const [terminal, setTerminal] = useState('PC')
  const [event, setEvent] = useState(0)
  const events = ['活体核验通过','检测到环境音频，风险低','切屏行为已拦截','作文双评差异 3.2 分，进入仲裁']
  useEffect(() => { const t = setInterval(() => setBankStep(v => (v + 1) % bank.length), 2600); return () => clearInterval(t) }, [])
  useEffect(() => { const t = setInterval(() => setPaperStep(v => (v + 1) % paper.length), 1800); return () => clearInterval(t) }, [])
  useEffect(() => { const t = setInterval(() => setEvent(v => (v + 1) % events.length), 2200); return () => clearInterval(t) }, [])
  const metrics = useMemo(() => [['在线考生','2,156','+18.6%'],['题库资源','128,640','+2,840'],['AI评阅准确率','96.8%','+1.4%'],['系统可用性','99.98%','稳定']], [])
  return <div className="demo-center">
    <div className="demo-hero"><div><div className="demo-kicker">衡鉴智考 · 全链路能力演示</div><h1>智慧考试平台演示中心</h1><p>从统一门户到指挥大屏，一次看清考试业务全流程。</p></div><div className="demo-orbit"><span>AI</span><i/><i/><i/></div></div>
    <div className="demo-metrics">{metrics.map(([a,b,c]) => <div className="demo-metric" key={a}><small>{a}</small><strong>{b}</strong><em>{c}</em></div>)}</div>
    <section className="demo-section"><div className="demo-section-head"><div><span>01</span><h2>统一门户 · 身份认证 · 教务对接</h2><p>统一入口承载多角色访问，认证后按组织与角色自动分发权限。</p></div><button onClick={() => navigate('/organization')}>打开权限管理 →</button></div><div className="portal-flow">{[['统一门户','统一导航与消息中心','🌐'],['统一身份认证','OAuth / LDAP / MFA','🔐'],['教务系统对接','组织、课程、学生同步','🔗']].map((x,i) => <div className="portal-node" key={x[0]}><b>{x[2]}</b><strong>{x[0]}</strong><small>{x[1]}</small>{i<2 && <i>→</i>}</div>)}</div><div className="role-grid">{roles.map(r => <div className="role-card" style={{'--role':r[3]}} key={r[0]}><span>{r[2]}</span><div><strong>{r[0]}</strong><small>{r[1]}</small></div><em>已授权</em></div>)}</div></section>
    <section className="demo-section"><div className="demo-section-head"><div><span>02</span><h2>AI 题库与试卷审核</h2><p>四级题库体系串联录入、AI导入、标签、智能组卷与审核。</p></div><button onClick={() => navigate('/question-bank')}>进入智能题库 →</button></div><div className="step-flow">{bank.map((x,i) => <div className={'step-node '+(i===bankStep?'active':'')} onClick={() => setBankStep(i)} key={x}><b>0{i+1}</b><strong>{x}</strong><small>{['试题录入 / 多数据源','知识点归一与去重','标签与能力关联','组卷、审核、发布'][i]}</small></div>)}</div><div className="demo-toolbar"><span>演示状态：<b>AI 正在解析第 {bankStep+1} 层资源</b></span><button onClick={() => navigate('/ai-question-generator')}>AI智能导入</button><button onClick={() => navigate('/tag-management')}>标签管理</button><button onClick={() => navigate('/paper-assembly')}>智能组卷</button></div></section>
    <section className="demo-section"><div className="demo-section-head"><div><span>03</span><h2>多终端在线考试 · 多模态监考</h2><p>PC、手机均可作答，活体、音视频、切屏和异常行为实时联动。</p></div><button onClick={() => navigate('/proctor-dashboard')}>打开监考大屏 →</button></div><div className="exam-demo"><div className="terminal-switch"><button className={terminal==='PC'?'on':''} onClick={() => setTerminal('PC')}>🖥️ 学生 PC</button><button className={terminal==='手机'?'on':''} onClick={() => setTerminal('手机')}>📱 学生手机</button><div className={'device '+(terminal==='手机'?'phone':'')}><div className="device-top">河南大学 · 大学英语期末考试 <b>剩余 42:18</b></div><div className="device-question">12. Choose the best answer for the following question.<div className="answer-line"/><div className="answer-line short"/><div className="answer-line"/></div><div className="device-foot">已作答 36 / 50 <button>下一题 →</button></div></div></div><div className="monitor-panel"><div className="monitor-head">多模态监考 <b>● 实时</b></div><div className="monitor-camera"><span>考生 128</span><span>音频正常</span><span>人脸匹配 99.8%</span></div><div className="alert-stream"><strong>实时事件流</strong><div><i/> {events[event]} <time>刚刚</time></div><div><i className="ok"/> 摄像头在线 · 128 路 <time>14:32:15</time></div></div></div></div></section>
    <section className="demo-section"><div className="demo-section-head"><div><span>04</span><h2>AI 纸笔考试全流程</h2><p>答题卡、印刷、扫描、流水阅卷状态自动流转。</p></div><button onClick={() => navigate('/print-management')}>进入印刷管理 →</button></div><div className="paper-flow">{paper.map((x,i) => <div className={'paper-node '+(i<=paperStep?'done':'')} key={x} onClick={() => setPaperStep(i)}><b>{i<paperStep?'✓':i+1}</b><strong>{x}</strong><small>{['模板智能校验','批次、密级、产能','OCR高速识别','AI初评 · 双评仲裁'][i]}</small>{i<3&&<i/>}</div>)}</div></section>
    <section className="demo-section"><div className="demo-section-head"><div><span>05</span><h2>智能评阅与教育分析</h2><p>外语作文、思政主观题支持 AI 初评、双评和仲裁，结果进入诊断引擎。</p></div><button onClick={() => navigate('/ai-grading')}>进入智能评阅 →</button></div><div className="insight-grid">{links.map(([x,to,icon]) => <button className="insight-card" key={to} onClick={() => navigate(to)}><span>{icon}</span><strong>{x}</strong><small>查看模块</small><b>↗</b></button>)}</div></section>
  </div>
}
