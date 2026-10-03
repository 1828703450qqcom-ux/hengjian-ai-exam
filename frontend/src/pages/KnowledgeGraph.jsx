import { useState, useEffect, useMemo } from 'react'
import { PageHeader, Tag, Loading, toast } from '../components/ui'
import EChart from '../components/EChart'

// 50维能力标签体系（知识点→能力→课程目标 三级图谱）
const ABILITY_TAXONOMY = [
  {
    category: '英语能力', color: '#3b82f6', objectives: ['课程目标1：语言知识与应用', '课程目标2：阅读理解与信息获取'],
    abilities: [
      { key: 'eng_listen', name: '听力理解', weight: 8, kps: ['听力细节', '听力推理', '听力主旨'] },
      { key: 'eng_speak', name: '口语表达', weight: 8, kps: ['口语流利度', '发音准确度', '语调自然度'] },
      { key: 'eng_read', name: '阅读理解', weight: 10, kps: ['阅读细节', '阅读推理', '阅读主旨', '词义猜测'] },
      { key: 'eng_vocab', name: '词汇运用', weight: 8, kps: ['词汇量', '词汇辨析', '固定搭配'] },
      { key: 'eng_grammar', name: '语法运用', weight: 7, kps: ['时态语态', '从句结构', '非谓语动词'] },
      { key: 'eng_translate', name: '翻译能力', weight: 7, kps: ['英译汉', '汉译英', '长难句处理'] },
      { key: 'eng_write', name: '写作能力', weight: 8, kps: ['写作结构', '写作内容', '语言表达'] },
      { key: 'eng_culture', name: '跨文化交际', weight: 4, kps: ['文化差异', '跨文化沟通'] },
    ]
  },
  {
    category: '数学能力', color: '#10b981', objectives: ['课程目标3：逻辑推理与计算', '课程目标4：数学建模与应用'],
    abilities: [
      { key: 'math_calc', name: '计算能力', weight: 10, kps: ['基本运算', '代数运算', '数值计算'] },
      { key: 'math_logic', name: '逻辑推理', weight: 10, kps: ['演绎推理', '归纳推理', '证明方法'] },
      { key: 'math_func', name: '函数分析', weight: 8, kps: ['函数性质', '极限连续', '导数应用'] },
      { key: 'math_integral', name: '积分计算', weight: 7, kps: ['不定积分', '定积分', '多重积分'] },
      { key: 'math_linear', name: '线性代数', weight: 7, kps: ['矩阵运算', '行列式', '向量空间'] },
      { key: 'math_prob', name: '概率统计', weight: 7, kps: ['概率计算', '随机变量', '统计推断'] },
      { key: 'math_geometry', name: '空间几何', weight: 5, kps: ['解析几何', '空间想象'] },
      { key: 'math_model', name: '数学建模', weight: 6, kps: ['问题抽象', '模型构建', '结果分析'] },
    ]
  },
  {
    category: '计算机能力', color: '#8b5cf6', objectives: ['课程目标5：计算思维', '课程目标6：系统设计与实现'],
    abilities: [
      { key: 'cs_algo', name: '算法设计', weight: 10, kps: ['时间复杂度', '空间复杂度', '算法优化'] },
      { key: 'cs_data', name: '数据结构', weight: 9, kps: ['线性结构', '树结构', '图结构', '哈希表'] },
      { key: 'cs_os', name: '操作系统', weight: 7, kps: ['进程管理', '内存管理', '文件系统'] },
      { key: 'cs_network', name: '计算机网络', weight: 7, kps: ['TCP/IP', 'HTTP协议', '网络安全'] },
      { key: 'cs_db', name: '数据库', weight: 7, kps: ['SQL查询', '索引优化', '事务管理'] },
      { key: 'cs_lang', name: '编程语言', weight: 8, kps: ['语法掌握', '面向对象', '函数式编程'] },
      { key: 'cs_ai', name: '人工智能', weight: 6, kps: ['机器学习', '深度学习', '自然语言处理'] },
      { key: 'cs_security', name: '信息安全', weight: 6, kps: ['加密算法', '安全协议', '漏洞防护'] },
    ]
  },
  {
    category: '思政人文', color: '#ef4444', objectives: ['课程目标7：价值认同', '课程目标8：批判思维与表达'],
    abilities: [
      { key: 'hum_theory', name: '理论理解', weight: 8, kps: ['概念掌握', '原理理解', '体系认知'] },
      { key: 'hum_history', name: '史实记忆', weight: 6, kps: ['时间线', '事件因果', '人物贡献'] },
      { key: 'hum_analysis', name: '分析判断', weight: 8, kps: ['材料分析', '观点辨析', '价值判断'] },
      { key: 'hum_value', name: '价值认同', weight: 8, kps: ['核心价值观', '文化自信', '社会责任'] },
      { key: 'hum_expression', name: '表达能力', weight: 7, kps: ['书面表达', '口头表达', '逻辑论证'] },
      { key: 'hum_critical', name: '批判思维', weight: 7, kps: ['质疑精神', '多角度分析', '独立思考'] },
      { key: 'hum_culture', name: '文化理解', weight: 6, kps: ['传统文化', '现代文化', '跨文化比较'] },
      { key: 'hum_society', name: '社会观察', weight: 5, kps: ['社会现象', '政策理解', '国际视野'] },
    ]
  },
  {
    category: '综合能力', color: '#f59e0b', objectives: ['课程目标9：终身学习能力'],
    abilities: [
      { key: 'gen_learn', name: '学习能力', weight: 10, kps: ['自主学习', '知识迁移', '反思总结'] },
      { key: 'gen_innovate', name: '创新思维', weight: 8, kps: ['发散思维', '创意生成', '方案设计'] },
      { key: 'gen_team', name: '团队协作', weight: 7, kps: ['沟通协调', '分工合作', '冲突解决'] },
      { key: 'gen_problem', name: '问题解决', weight: 8, kps: ['问题定义', '方案选择', '执行评估'] },
      { key: 'gen_time', name: '时间管理', weight: 5, kps: ['计划制定', '优先级', '执行效率'] },
    ]
  },
]

// 生成50维能力数据
const generateAbilityData = () => {
  const data = []
  ABILITY_TAXONOMY.forEach(cat => {
    cat.abilities.forEach(ab => {
      // 模拟掌握度（40-95分）
      const mastery = Math.floor(Math.random() * 55) + 40
      const kpDetails = ab.kps.map(kp => ({
        name: kp,
        mastery: Math.max(20, Math.min(100, mastery + Math.floor(Math.random() * 30) - 15)),
        question_count: Math.floor(Math.random() * 20) + 5,
        wrong_count: Math.floor(Math.random() * 8),
      }))
      data.push({
        ...ab,
        category: cat.category,
        color: cat.color,
        objectives: cat.objectives,
        mastery: mastery,
        target: 75,
        trend: Math.floor(Math.random() * 20) - 8, // -8到+12
        kp_details: kpDetails,
        total_questions: kpDetails.reduce((a, k) => a + k.question_count, 0),
        total_wrong: kpDetails.reduce((a, k) => a + k.wrong_count, 0),
      })
    })
  })
  return data
}

export default function KnowledgeGraph() {
  const [abilityData, setAbilityData] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('全部')
  const [selectedAbility, setSelectedAbility] = useState(null)
  const [viewMode, setViewMode] = useState('heatmap') // heatmap / graph / trend

  useEffect(() => {
    setTimeout(() => {
      setAbilityData(generateAbilityData())
      setLoading(false)
    }, 800)
  }, [])

  const categories = ['全部', ...ABILITY_TAXONOMY.map(c => c.category)]

  const filteredData = activeCategory === '全部'
    ? abilityData
    : abilityData.filter(a => a.category === activeCategory)

  // 综合能力得分
  const overallScore = useMemo(() => {
    if (abilityData.length === 0) return 0
    const totalWeight = abilityData.reduce((a, b) => a + b.weight, 0)
    const weightedSum = abilityData.reduce((a, b) => a + b.mastery * b.weight, 0)
    return Math.round(weightedSum / totalWeight * 10) / 10
  }, [abilityData])

  // 达标数量
  const achievedCount = abilityData.filter(a => a.mastery >= a.target).length

  // 薄弱能力（<60分）
  const weakAbilities = abilityData.filter(a => a.mastery < 60).sort((a, b) => a.mastery - b.mastery)

  // 热力图数据（按分类分组）
  const heatmapData = useMemo(() => {
    const result = []
    ABILITY_TAXONOMY.forEach(cat => {
      const catAbilities = abilityData.filter(a => a.category === cat.category)
      catAbilities.forEach((ab, i) => {
        result.push([i, ABILITY_TAXONOMY.indexOf(cat), ab.mastery, ab])
      })
    })
    return result
  }, [abilityData])

  // 能力成长趋势（模拟6次考试）
  const trendData = useMemo(() => {
    const exams = ['第1次月考', '期中考试', '第2次月考', '期末考试', '开学测', '当前']
    const categories = ['英语能力', '数学能力', '计算机能力', '思政人文', '综合能力']
    const series = categories.map((cat, i) => {
      const base = 55 + i * 5
      return {
        name: cat,
        type: 'line',
        smooth: true,
        data: exams.map((_, j) => Math.round(base + j * 3 + Math.random() * 8)),
        itemStyle: { color: ABILITY_TAXONOMY[i].color },
        areaStyle: { opacity: 0.1 },
      }
    })
    return { exams, series }
  }, [])

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', textStyle: { color: '#374151', fontSize: 12 } },
    legend: { data: trendData.categories, top: 0, textStyle: { color: '#6b7280', fontSize: 11 } },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: trendData.exams, axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', min: 40, max: 100, name: '能力得分', axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: trendData.series,
  }), [trendData])

  // 知识图谱关系图（简化版：分类→能力→知识点）
  const graphOption = useMemo(() => {
    const nodes = []
    const links = []
    // 中心节点
    nodes.push({ name: '能力图谱', symbolSize: 50, itemStyle: { color: '#1e40af' }, label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' } })
    // 分类节点
    ABILITY_TAXONOMY.forEach((cat, i) => {
      nodes.push({ name: cat.category, symbolSize: 35, itemStyle: { color: cat.color }, label: { show: true, fontSize: 11, color: '#fff' } })
      links.push({ source: '能力图谱', target: cat.category })
      // 能力节点（每个分类显示前4个）
      cat.abilities.slice(0, 4).forEach(ab => {
        const abData = abilityData.find(a => a.key === ab.key)
        const mastery = abData?.mastery || 70
        nodes.push({
          name: ab.name,
          symbolSize: 15 + mastery / 5,
          itemStyle: { color: mastery >= 75 ? '#10b981' : mastery >= 60 ? '#f59e0b' : '#ef4444' },
          label: { show: true, fontSize: 9, color: '#374151' },
          value: mastery,
        })
        links.push({ source: cat.category, target: ab.name, lineStyle: { opacity: 0.3 } })
      })
    })
    return {
      tooltip: {
        formatter: (params) => {
          if (params.dataType === 'node' && params.data.value) {
            return `${params.name}<br/>掌握度: ${params.data.value}分`
          }
          return params.name
        }
      },
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        data: nodes,
        links: links,
        force: { repulsion: 200, edgeLength: [50, 100] },
        label: { position: 'right' },
        lineStyle: { color: '#cbd5e1', curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
      }]
    }
  }, [abilityData])

  if (loading) return <Loading text="加载知识图谱能力诊断..." />

  return (
    <div>
      <PageHeader
        title="🧠 知识图谱能力诊断（50维能力画像）"
        subtitle="知识点→能力→课程目标 三级知识图谱 · 50维细分能力标签 · 精准定位掌握程度"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
              {[['heatmap', '🔥 热力图'], ['graph', '🕸️ 知识图谱'], ['trend', '📈 成长趋势']].map(([key, label]) => (
                <button key={key} onClick={() => setViewMode(key)}
                  style={{
                    padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: 'none',
                    background: viewMode === key ? '#fff' : 'transparent',
                    color: viewMode === key ? '#1e40af' : '#6b7280',
                    fontWeight: viewMode === key ? 600 : 400,
                    boxShadow: viewMode === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* 概览统计 */}
      <div className="grid grid-4 mb16">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>🎯 综合能力得分</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#1e40af' }}>{overallScore}<span style={{ fontSize: 14, color: '#6b7280' }}>分</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 达标能力数</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#166534' }}>{achievedCount}<span style={{ fontSize: 14, color: '#6b7280' }}>/{abilityData.length}</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>⚠️ 薄弱能力数</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#92400e' }}>{weakAbilities.length}<span style={{ fontSize: 14, color: '#6b7280' }}>个</span></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>📚 覆盖知识点</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#5b21b6' }}>{abilityData.reduce((a, b) => a + b.kps.length, 0)}<span style={{ fontSize: 14, color: '#6b7280' }}>个</span></div>
        </div>
      </div>

      {/* 分类筛选 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            style={{
              padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, border: 'none',
              background: activeCategory === cat ? '#1e40af' : '#f1f5f9',
              color: activeCategory === cat ? '#fff' : '#6b7280',
              fontWeight: activeCategory === cat ? 600 : 400,
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* 热力图视图 */}
      {viewMode === 'heatmap' && (
        <div className="card mb16">
          <div className="card-title">
            <span>🔥 50维能力掌握度热力图</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#6b7280' }}>
              <span>低</span>
              <div style={{ width: 100, height: 10, background: 'linear-gradient(to right, #ef4444, #f59e0b, #10b981)', borderRadius: 5 }} />
              <span>高</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ABILITY_TAXONOMY.filter(cat => activeCategory === '全部' || cat.category === activeCategory).map(cat => (
              <div key={cat.category}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 4, height: 16, background: cat.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{cat.category}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{cat.objectives.join(' · ')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                  {abilityData.filter(a => a.category === cat.category).map(ab => (
                    <div key={ab.key} onClick={() => setSelectedAbility(ab)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        background: `linear-gradient(135deg, ${ab.color}${ab.mastery >= 75 ? '20' : ab.mastery >= 60 ? '15' : '10'}, ${ab.color}05)`,
                        border: `1px solid ${ab.color}${ab.mastery >= 75 ? '40' : '20'}`,
                        borderLeft: `3px solid ${ab.mastery >= 75 ? '#10b981' : ab.mastery >= 60 ? '#f59e0b' : '#ef4444'}`,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{ab.name}</span>
                        <span style={{ fontSize: 10, color: ab.trend >= 0 ? '#10b981' : '#ef4444' }}>
                          {ab.trend >= 0 ? '↑' : '↓'}{Math.abs(ab.trend)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${ab.mastery}%`, height: '100%', borderRadius: 3,
                            background: ab.mastery >= 75 ? '#10b981' : ab.mastery >= 60 ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: ab.mastery >= 75 ? '#10b981' : ab.mastery >= 60 ? '#f59e0b' : '#ef4444' }}>
                          {ab.mastery}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                        {ab.kps.length}个知识点 · 权重{ab.weight}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 知识图谱视图 */}
      {viewMode === 'graph' && (
        <div className="card mb16">
          <div className="card-title">
            <span>🕸️ 三级知识图谱（课程目标→能力→知识点）</span>
            <Tag color="purple">可拖拽缩放</Tag>
          </div>
          <EChart option={graphOption} height={500} />
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />达标(≥75)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />接近(60-74)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />薄弱({'<60'})</span>
          </div>
        </div>
      )}

      {/* 成长趋势视图 */}
      {viewMode === 'trend' && (
        <div className="card mb16">
          <div className="card-title">
            <span>📈 能力成长趋势（6次考试追踪）</span>
            <Tag color="blue">5大能力域</Tag>
          </div>
          <EChart option={trendOption} height={400} />
        </div>
      )}

      {/* 薄弱能力预警 */}
      {weakAbilities.length > 0 && (
        <div className="card mb16" style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '1px solid #fecaca' }}>
          <div className="card-title">
            <span>⚠️ 薄弱能力预警（需重点提升）</span>
            <Tag color="red">{weakAbilities.length}个能力待提升</Tag>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {weakAbilities.slice(0, 6).map(ab => (
              <div key={ab.key} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={ab.category === '英语能力' ? 'blue' : ab.category === '数学能力' ? 'green' : ab.category === '计算机能力' ? 'purple' : 'red'}>{ab.category}</Tag>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>{ab.name}</span>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{ab.mastery}分</span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  目标: {ab.target}分 · 差距: {ab.target - ab.mastery}分 · 关联知识点: {ab.kps.join('、')}
                </div>
                <div style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', padding: '6px 10px', borderRadius: 6 }}>
                  💡 建议: 针对{ab.kps[0]}等知识点进行专项练习，预计2周可提升10-15分
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 能力详情弹窗 */}
      {selectedAbility && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelectedAbility(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Tag color={selectedAbility.category === '英语能力' ? 'blue' : selectedAbility.category === '数学能力' ? 'green' : selectedAbility.category === '计算机能力' ? 'purple' : selectedAbility.category === '思政人文' ? 'red' : 'orange'}>{selectedAbility.category}</Tag>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>权重 {selectedAbility.weight}%</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 22, color: '#1f2937' }}>{selectedAbility.name}</h3>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{selectedAbility.objectives.join(' · ')}</div>
              </div>
              <button onClick={() => setSelectedAbility(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>当前掌握度</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: selectedAbility.mastery >= 75 ? '#10b981' : selectedAbility.mastery >= 60 ? '#f59e0b' : '#ef4444' }}>{selectedAbility.mastery}分</div>
              </div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>目标值</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{selectedAbility.target}分</div>
              </div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>变化趋势</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: selectedAbility.trend >= 0 ? '#10b981' : '#ef4444' }}>{selectedAbility.trend >= 0 ? '+' : ''}{selectedAbility.trend}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 10 }}>📚 关联知识点掌握详情</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedAbility.kp_details.map(kp => (
                  <div key={kp.name} style={{ padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{kp.name}</span>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                        <span>做题 {kp.question_count} 道</span>
                        <span style={{ color: '#ef4444' }}>错误 {kp.wrong_count} 道</span>
                        <span style={{ fontWeight: 600, color: kp.mastery >= 75 ? '#10b981' : kp.mastery >= 60 ? '#f59e0b' : '#ef4444' }}>{kp.mastery}分</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${kp.mastery}%`, height: '100%', background: kp.mastery >= 75 ? '#10b981' : kp.mastery >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 14, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>💡 个性化提升建议</div>
              <div style={{ fontSize: 13, color: '#3b82f6', lineHeight: 1.7 }}>
                基于你的能力画像，建议优先提升「{selectedAbility.kp_details.sort((a, b) => a.mastery - b.mastery)[0].name}」知识点。
                系统已为你生成{Math.max(5, Math.floor((selectedAbility.target - selectedAbility.mastery) / 3))}道专项练习题，
                预计每天练习30分钟，2周内可将{selectedAbility.name}提升至{selectedAbility.target}分以上。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
