import React, { useState, useEffect, useCallback } from 'react';
// 使用emoji图标，无需额外依赖
import api from '../api';

const STATUS_MAP = {
  draft: { label: '草稿', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  pending_review: { label: '待审核', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  rejected: { label: '已驳回', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  accepted: { label: '已审核通过', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  pending_print: { label: '待印刷', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  printing: { label: '印刷中', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  pending_pickup: { label: '待领取', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  picking_up: { label: '领取中', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  completed: { label: '已完成', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
};

const PrintManagement = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [factories, setFactories] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showFactoryModal, setShowFactoryModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [editingFactory, setEditingFactory] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');

  // 任务表单
  const [taskForm, setTaskForm] = useState({
    title: '', exam_id: '', course_id: '', factory_id: '',
    paper_count: 0, answer_sheet_count: 0, paper_type: 'A3',
    answer_sheet_type: 'A3', binding_requirement: '', packaging_requirement: '',
    deadline: '', contact_phone: '', confidentiality_enabled: true,
  });

  // 印厂表单
  const [factoryForm, setFactoryForm] = useState({
    name: '', manager_id: '', reviewer_id: '', contact_phone: '',
    address: '', support_binding: true, support_packaging: true, paper_types: [],
  });

  // 领取表单
  const [pickupForm, setPickupForm] = useState({
    picker_name: '', picker_dept: '', paper_count: 0, answer_sheet_count: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, factoriesRes, statsRes, dashRes] = await Promise.all([
        api.get('/print/tasks'),
        api.get('/print/factories'),
        api.get('/print/statistics'),
        api.get('/print/dashboard'),
      ]);
      setTasks(tasksRes.data.tasks || []);
      setFactories(factoriesRes.data.factories || []);
      setStatistics(statsRes.data);
      setDashboard(dashRes.data);
    } catch (e) {
      console.error('获取印刷管理数据失败', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTasks = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (searchText && !t.title.includes(searchText) && !t.task_no.includes(searchText)) return false;
    return true;
  });

  // 创建任务
  const handleCreateTask = async () => {
    try {
      await api.post('/print/tasks', taskForm);
      setShowTaskModal(false);
      setTaskForm({ title: '', exam_id: '', course_id: '', factory_id: '', paper_count: 0, answer_sheet_count: 0, paper_type: 'A3', answer_sheet_type: 'A3', binding_requirement: '', packaging_requirement: '', deadline: '', contact_phone: '', confidentiality_enabled: true });
      fetchData();
    } catch (e) {
      alert('创建任务失败: ' + (e.response?.data?.detail || e.message));
    }
  };

  // 创建/编辑印厂
  const handleSaveFactory = async () => {
    try {
      if (editingFactory) {
        await api.put(`/print/factories/${editingFactory.id}`, factoryForm);
      } else {
        await api.post('/print/factories', factoryForm);
      }
      setShowFactoryModal(false);
      setEditingFactory(null);
      setFactoryForm({ name: '', manager_id: '', reviewer_id: '', contact_phone: '', address: '', support_binding: true, support_packaging: true, paper_types: [] });
      fetchData();
    } catch (e) {
      alert('保存印厂失败: ' + (e.response?.data?.detail || e.message));
    }
  };

  // 任务操作
  const handleTaskAction = async (taskId, action, extraData = {}) => {
    try {
      const actionMap = {
        submit: '/print/tasks/{id}/submit',
        withdraw: '/print/tasks/{id}/withdraw',
        review: '/print/tasks/{id}/review',
        accept: '/print/tasks/{id}/accept',
        start_printing: '/print/tasks/{id}/start-printing',
        complete_printing: '/print/tasks/{id}/complete-printing',
        start_picking: '/print/tasks/{id}/start-picking',
        complete_picking: '/print/tasks/{id}/complete-picking',
      };
      const url = actionMap[action].replace('{id}', taskId);
      if (action === 'review') {
        const result = prompt('请输入审核结果 (approved/rejected):', 'approved');
        const comment = prompt('请输入审核意见:', '');
        await api.post(url, { result, comment });
      } else if (action === 'start_printing' || action === 'complete_printing') {
        const paperSheets = prompt('请输入试卷用纸数:', '0');
        const answerSheets = prompt('请输入答题卡用纸数:', '0');
        await api.post(url, { paper_sheets_used: parseInt(paperSheets) || 0, answer_sheet_sheets_used: parseInt(answerSheets) || 0 });
      } else {
        await api.post(url, extraData);
      }
      fetchData();
      if (selectedTask?.id === taskId) {
        const detail = await api.get(`/print/tasks/${taskId}`);
        setSelectedTask(detail.data);
      }
      alert('操作成功');
    } catch (e) {
      alert('操作失败: ' + (e.response?.data?.detail || e.message));
    }
  };

  // 添加领取记录
  const handleAddPickup = async () => {
    try {
      await api.post(`/print/tasks/${selectedTask.id}/pickups`, pickupForm);
      setShowPickupModal(false);
      setPickupForm({ picker_name: '', picker_dept: '', paper_count: 0, answer_sheet_count: 0 });
      const detail = await api.get(`/print/tasks/${selectedTask.id}`);
      setSelectedTask(detail.data);
      fetchData();
    } catch (e) {
      alert('添加领取记录失败: ' + (e.response?.data?.detail || e.message));
    }
  };

  const tabs = [
    { id: 'dashboard', label: '数据大屏', icon: '📊' },
    { id: 'tasks', label: '任务管理', icon: '📄' },
    { id: 'factories', label: '印厂管理', icon: '🏭' },
    { id: 'statistics', label: '统计分析', icon: '📈' },
  ];

  return (
    <div className="print-management" style={{ padding: '24px', minHeight: '100vh' }}>
      <style>{`
        .print-management .pm-card {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          padding: 20px;
        }
        .print-management .pm-stat-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.8));
          border-radius: 14px;
          padding: 18px;
          border-left: 4px solid;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .print-management .pm-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.1);
        }
        .print-management .pm-btn {
          padding: '8px 16px';
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .print-management .pm-btn-primary {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }
        .print-management .pm-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .print-management .pm-btn-success { background: linear-gradient(135deg, #10b981, #059669); color: white; }
        .print-management .pm-btn-warning { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
        .print-management .pm-btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
        .print-management .pm-btn-info { background: linear-gradient(135deg, #06b6d4, #0891b2); color: white; }
        .print-management .pm-btn-secondary { background: #f1f5f9; color: #475569; }
        .print-management .pm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .print-management .pm-table { width: 100%; border-collapse: collapse; }
        .print-management .pm-table th {
          text-align: left; padding: 12px; font-size: 12px; font-weight: 600;
          color: #64748b; border-bottom: 2px solid #e2e8f0; background: rgba(248,250,252,0.5);
        }
        .print-management .pm-table td {
          padding: 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9;
        }
        .print-management .pm-table tr:hover { background: rgba(59,130,246,0.03); }
        .print-management .pm-status-badge {
          display: inline-block; padding: 4px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600;
        }
        .print-management .pm-tab {
          padding: 10px 20px; border-radius: 10px; cursor: pointer;
          font-size: 14px; font-weight: 500; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px; color: #64748b;
        }
        .print-management .pm-tab:hover { background: rgba(59,130,246,0.08); color: #3b82f6; }
        .print-management .pm-tab.active {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white; box-shadow: 0 4px 12px rgba(59,130,246,0.3);
        }
        .print-management .pm-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .print-management .pm-modal {
          background: white; border-radius: 16px; padding: 24px;
          max-width: 600px; width: 90%; max-height: 85vh; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .print-management .pm-input {
          width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0;
          border-radius: 8px; font-size: 13px; transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .print-management .pm-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .print-management .pm-label { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block; }
        .print-management .pm-timeline-item {
          display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9;
        }
        .print-management .pm-timeline-dot {
          width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; flex-shrink: 0;
        }
      `}</style>

      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🖨️
            印刷管理系统
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
            试卷和答题卡印刷全流程线上管控 · 印厂管理 · 任务审核 · 印刷进度 · 领取记录
          </p>
        </div>
      </div>

      {/* 标签页 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`pm-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </div>
        ))}
      </div>

      {/* 数据大屏 */}
      {activeTab === 'dashboard' && dashboard && (
        <div>
          {/* 统计卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="pm-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>今日任务数</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>{dashboard.today_task_count}</div>
            </div>
            <div className="pm-stat-card" style={{ borderLeftColor: '#10b981' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>今日印刷份数</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>{dashboard.today_paper_count}</div>
            </div>
            <div className="pm-stat-card" style={{ borderLeftColor: '#f59e0b' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>进行中任务</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>{dashboard.active_task_count}</div>
            </div>
            <div className="pm-stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>累计任务数</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>{dashboard.total_task_count}</div>
            </div>
          </div>

          {dashboard.quality && <div className="print-quality-grid">
            {[
              ['准时完成率', `${dashboard.quality.completion_rate}%`, '当前周期任务交付', 'blue'],
              ['24小时紧急任务', dashboard.quality.urgent_count, '需要优先排产', 'orange'],
              ['逾期任务', dashboard.quality.overdue_count, '需立即处理', 'red'],
              ['保密任务', dashboard.quality.confidential_active, '全流程留痕', 'purple'],
              ['累计用纸', dashboard.quality.total_sheets.toLocaleString(), '试卷与答题卡', 'green'],
              ['印厂利用率', `${dashboard.quality.factory_utilization}%`, '活跃印厂占比', 'cyan'],
            ].map(x=><div className={`print-quality ${x[3]}`} key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div>)}
          </div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* 状态分布 */}
            <div className="pm-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>任务状态分布</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(dashboard.status_counts).map(([status, count]) => {
                  const s = STATUS_MAP[status] || { label: status, color: '#94a3b8' };
                  const total = Object.values(dashboard.status_counts).reduce((a, b) => a + b, 0);
                  const percent = total > 0 ? (count / total * 100).toFixed(1) : 0;
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ color: '#475569' }}>{s.label}</span>
                        <span style={{ fontWeight: 600, color: s.color }}>{count} ({percent}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percent}%`, background: s.color, borderRadius: '4px', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 印厂工作量 */}
            <div className="pm-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>印厂工作量</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dashboard.factory_workload.map(f => (
                  <div key={f.factory_id} style={{ padding: '12px', background: 'rgba(59,130,246,0.04)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{f.factory_name}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{f.active_task_count} 个进行中任务</span>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                      待印刷试卷: <span style={{ fontWeight: 600, color: '#3b82f6' }}>{f.total_paper}</span> 份
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {dashboard.urgent_tasks?.length > 0 && <div className="pm-card print-alert-panel" style={{ marginTop: 20 }}><div><b>紧急排产提醒</b><span>以下任务将在24小时内到期或已经逾期</span></div>{dashboard.urgent_tasks.map(t=><button key={t.id} onClick={()=>{setSelectedTask(t);setActiveTab('tasks')}}><span>{t.task_no}</span><b>{t.title}</b><em>{t.paper_count}份</em></button>)}</div>}

          {/* 最近任务 */}
          <div className="pm-card" style={{ marginTop: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>最近任务</h3>
            <table className="pm-table">
              <thead>
                <tr>
                  <th>任务编号</th>
                  <th>任务标题</th>
                  <th>状态</th>
                  <th>试卷份数</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_tasks.map(t => {
                  const s = STATUS_MAP[t.status] || { label: t.status, color: '#94a3b8' };
                  return (
                    <tr key={t.id} onClick={() => { setSelectedTask(t); setActiveTab('tasks'); }} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'monospace', color: '#3b82f6' }}>{t.task_no}</td>
                      <td>{t.title}</td>
                      <td><span className="pm-status-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                      <td>{t.paper_count}</td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>{t.created_at?.slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 任务管理 */}
      {activeTab === 'tasks' && (
        <div>
          {/* 工具栏 */}
          <div className="pm-card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                🔍
                <input
                  className="pm-input"
                  placeholder="搜索任务编号/标题..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  style={{ paddingLeft: '34px', width: '220px' }}
                />
              </div>
              <select className="pm-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '140px' }}>
                <option value="">全部状态</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <button className="pm-btn pm-btn-primary" onClick={() => setShowTaskModal(true)}>
              ➕ 创建印刷任务
            </button>
          </div>

          {/* 任务列表 */}
          <div className="pm-card">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>任务编号</th>
                  <th>任务标题</th>
                  <th>印厂</th>
                  <th>试卷/答题卡</th>
                  <th>状态</th>
                  <th>截止日期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(t => {
                  const s = STATUS_MAP[t.status] || { label: t.status, color: '#94a3b8' };
                  return (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'monospace', color: '#3b82f6', cursor: 'pointer' }} onClick={async () => {
                        const detail = await api.get(`/print/tasks/${t.id}`);
                        setSelectedTask(detail.data);
                      }}>{t.task_no}</td>
                      <td>{t.title}</td>
                      <td>{t.factory_name || '-'}</td>
                      <td>{t.paper_count} / {t.answer_sheet_count}</td>
                      <td><span className="pm-status-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>{t.deadline?.slice(0, 10) || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {t.status === 'draft' && (
                            <>
                              <button className="pm-btn pm-btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleTaskAction(t.id, 'submit')}>提交审核</button>
                            </>
                          )}
                          {t.status === 'pending_review' && (
                            <>
                              <button className="pm-btn pm-btn-success" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleTaskAction(t.id, 'review')}>审核</button>
                              <button className="pm-btn pm-btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleTaskAction(t.id, 'withdraw')}>撤回</button>
                            </>
                          )}
                          {t.status === 'accepted' && (
                            <button className="pm-btn pm-btn-info" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleTaskAction(t.id, 'accept')}>接受任务</button>
                          )}
                          {t.status === 'pending_print' && (
                            <button className="pm-btn pm-btn-warning" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleTaskAction(t.id, 'start_printing')}>开始印刷</button>
                          )}
                          {t.status === 'printing' && (
                            <button className="pm-btn pm-btn-success" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleTaskAction(t.id, 'complete_printing')}>完成印刷</button>
                          )}
                          {t.status === 'pending_pickup' && (
                            <button className="pm-btn pm-btn-info" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleTaskAction(t.id, 'start_picking')}>开始领取</button>
                          )}
                          {t.status === 'picking_up' && (
                            <>
                              <button className="pm-btn pm-btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={async () => {
                                const detail = await api.get(`/print/tasks/${t.id}`);
                                setSelectedTask(detail.data);
                                setShowPickupModal(true);
                              }}>添加领取</button>
                              <button className="pm-btn pm-btn-success" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleTaskAction(t.id, 'complete_picking')}>结束领取</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                📄
                <p>暂无印刷任务</p>
              </div>
            )}
          </div>

          {/* 任务详情侧边栏 */}
          {selectedTask && (
            <div className="pm-card" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                  任务详情: {selectedTask.task_no} - {selectedTask.title}
                </h3>
                <button className="pm-btn pm-btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setSelectedTask(null)}>
                  ✕ 关闭
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* 基本信息 */}
                <div>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>基本信息</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div><span style={{ color: '#64748b' }}>课程: </span>{selectedTask.course_name || '-'}</div>
                    <div><span style={{ color: '#64748b' }}>印厂: </span>{selectedTask.factory_name || '-'}</div>
                    <div><span style={{ color: '#64748b' }}>创建人: </span>{selectedTask.creator_name || '-'}</div>
                    <div><span style={{ color: '#64748b' }}>试卷份数: </span>{selectedTask.paper_count}</div>
                    <div><span style={{ color: '#64748b' }}>答题卡份数: </span>{selectedTask.answer_sheet_count}</div>
                    <div><span style={{ color: '#64748b' }}>纸张类型: </span>{selectedTask.paper_type} / {selectedTask.answer_sheet_type}</div>
                    <div><span style={{ color: '#64748b' }}>联系电话: </span>{selectedTask.contact_phone || '-'}</div>
                    <div><span style={{ color: '#64748b' }}>保密性: </span>{selectedTask.confidentiality_enabled ? '启用' : '关闭'}</div>
                  </div>
                </div>

                {/* 审核记录 */}
                <div>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>审核记录</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(selectedTask.reviews || []).length === 0 && <span style={{ color: '#94a3b8', fontSize: '12px' }}>暂无审核记录</span>}
                    {(selectedTask.reviews || []).map(r => (
                      <div key={r.id} style={{ padding: '8px 12px', background: r.result === 'approved' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '8px', fontSize: '12px' }}>
                        <div style={{ fontWeight: 600, color: r.result === 'approved' ? '#059669' : '#dc2626' }}>
                          {r.result === 'approved' ? '✓ 审核通过' : '✗ 审核驳回'}
                        </div>
                        {r.comment && <div style={{ color: '#64748b', marginTop: '4px' }}>{r.comment}</div>}
                        <div style={{ color: '#94a3b8', marginTop: '4px' }}>{r.time?.slice(0, 16).replace('T', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 印刷进度时间线 */}
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>印刷进度</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {(selectedTask.records || []).map((r, idx) => {
                    const actionMap = {
                      accepted: { label: '任务已接受', color: '#3b82f6' },
                      start_printing: { label: '开始印刷', color: '#f59e0b' },
                      complete_printing: { label: '完成印刷', color: '#10b981' },
                      start_picking: { label: '开始领取', color: '#8b5cf6' },
                      complete_picking: { label: '领取完成', color: '#22c55e' },
                    };
                    const a = actionMap[r.action] || { label: r.action, color: '#94a3b8' };
                    return (
                      <div key={r.id} className="pm-timeline-item">
                        <div className="pm-timeline-dot" style={{ background: a.color }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>{a.label}</div>
                          {(r.paper_sheets > 0 || r.answer_sheet_sheets > 0) && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              试卷用纸: {r.paper_sheets}张, 答题卡用纸: {r.answer_sheet_sheets}张
                            </div>
                          )}
                          {r.remark && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{r.remark}</div>}
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{r.time?.slice(0, 16).replace('T', ' ')}</div>
                        </div>
                      </div>
                    );
                  })}
                  {(selectedTask.records || []).length === 0 && <span style={{ color: '#94a3b8', fontSize: '12px' }}>暂无印刷进度记录</span>}
                </div>
              </div>

              {/* 领取记录 */}
              {(selectedTask.pickups || []).length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>领取记录</h4>
                  <table className="pm-table">
                    <thead>
                      <tr><th>领取人</th><th>部门</th><th>试卷数</th><th>答题卡数</th><th>领取时间</th></tr>
                    </thead>
                    <tbody>
                      {(selectedTask.pickups || []).map(p => (
                        <tr key={p.id}>
                          <td>{p.picker_name}</td>
                          <td>{p.picker_dept || '-'}</td>
                          <td>{p.paper_count}</td>
                          <td>{p.answer_sheet_count}</td>
                          <td style={{ color: '#64748b', fontSize: '12px' }}>{p.picked_at?.slice(0, 16).replace('T', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 印厂管理 */}
      {activeTab === 'factories' && (
        <div>
          <div className="pm-card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>印厂列表 ({factories.length})</h3>
            <button className="pm-btn pm-btn-primary" onClick={() => { setEditingFactory(null); setShowFactoryModal(true); }}>
              ➕ 添加印厂
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {factories.map(f => (
              <div key={f.id} className="pm-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      🏭
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>{f.name}</div>
                      <span className="pm-status-badge" style={{ background: f.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)', color: f.status === 'active' ? '#059669' : '#64748b' }}>
                        {f.status === 'active' ? '启用中' : '已禁用'}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                  <div>👤管理员: {f.manager_name || '-'}</div>
                  <div>✅审核员: {f.reviewer_name || '-'}</div>
                  <div>📅电话: {f.contact_phone || '-'}</div>
                  <div>📍地址: {f.address || '-'}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {f.support_binding && <span style={{ padding: '2px 8px', background: 'rgba(16,185,129,0.1)', color: '#059669', borderRadius: '4px', fontSize: '11px' }}>支持装订</span>}
                  {f.support_packaging && <span style={{ padding: '2px 8px', background: 'rgba(59,130,246,0.1)', color: '#2563eb', borderRadius: '4px', fontSize: '11px' }}>支持分装</span>}
                  {(f.paper_types || []).map(p => (
                    <span key={p} style={{ padding: '2px 8px', background: 'rgba(139,92,246,0.1)', color: '#7c3aed', borderRadius: '4px', fontSize: '11px' }}>{p}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="pm-btn pm-btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '12px' }} onClick={() => { setEditingFactory(f); setFactoryForm({ name: f.name, manager_id: f.manager_id || '', reviewer_id: f.reviewer_id || '', contact_phone: f.contact_phone || '', address: f.address || '', support_binding: f.support_binding, support_packaging: f.support_packaging, paper_types: f.paper_types || [] }); setShowFactoryModal(true); }}>
                    ✏️ 编辑
                  </button>
                  <button className="pm-btn pm-btn-danger" style={{ flex: 1, padding: '6px', fontSize: '12px' }} onClick={async () => { if (confirm('确定要禁用该印厂吗?')) { await api.delete(`/print/factories/${f.id}`); fetchData(); } }}>
                    🗑️ 禁用
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 统计分析 */}
      {activeTab === 'statistics' && statistics && (
        <div>
          {/* 总览卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="pm-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>总任务数</div>
              <div style={{ fontSize: '26px', fontWeight: 700 }}>{statistics.total_tasks}</div>
            </div>
            <div className="pm-stat-card" style={{ borderLeftColor: '#10b981' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>总试卷数</div>
              <div style={{ fontSize: '26px', fontWeight: 700 }}>{statistics.total_paper}</div>
            </div>
            <div className="pm-stat-card" style={{ borderLeftColor: '#f59e0b' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>总答题卡数</div>
              <div style={{ fontSize: '26px', fontWeight: 700 }}>{statistics.total_answer_sheet}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* 印厂统计 */}
            <div className="pm-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>印厂工作量统计</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(statistics.factory_stats).map(([name, stats]) => (
                  <div key={name} style={{ padding: '12px', background: 'rgba(59,130,246,0.04)', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>{name}</div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#64748b' }}>
                      <span>任务: <b style={{ color: '#3b82f6' }}>{stats.task_count}</b></span>
                      <span>试卷: <b style={{ color: '#10b981' }}>{stats.paper_count}</b></span>
                      <span>答题卡: <b style={{ color: '#f59e0b' }}>{stats.answer_sheet_count}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 课程统计 */}
            <div className="pm-card">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>课程印刷量统计</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(statistics.course_stats).map(([name, stats]) => (
                  <div key={name} style={{ padding: '12px', background: 'rgba(139,92,246,0.04)', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      任务: <b style={{ color: '#8b5cf6' }}>{stats.task_count}</b> 个, 试卷: <b style={{ color: '#8b5cf6' }}>{stats.paper_count}</b> 份
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 每日趋势 */}
          <div className="pm-card" style={{ marginTop: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>近30天印刷量趋势</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '200px', padding: '0 8px' }}>
              {statistics.daily_trend.map((day, idx) => {
                const maxPaper = Math.max(...statistics.daily_trend.map(d => d.paper_count), 1);
                const height = (day.paper_count / maxPaper) * 100;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} title={`${day.date}: ${day.paper_count}份`}>
                    <div style={{ width: '100%', background: height > 0 ? 'linear-gradient(180deg, #3b82f6, #2563eb)' : 'transparent', height: `${height}%`, borderRadius: '4px 4px 0 0', minHeight: day.paper_count > 0 ? '4px' : '0', transition: 'height 0.3s' }} />
                    {idx % 5 === 0 && <span style={{ fontSize: '9px', color: '#94a3b8', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{day.date.slice(5)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 创建任务弹窗 */}
      {showTaskModal && (
        <div className="pm-modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600 }}>创建印刷任务</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="pm-label">任务标题 *</label>
                <input className="pm-input" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="如: 2024秋季期末考试印刷" />
              </div>
              <div>
                <label className="pm-label">选择印厂</label>
                <select className="pm-input" value={taskForm.factory_id} onChange={e => setTaskForm({ ...taskForm, factory_id: e.target.value })}>
                  <option value="">请选择印厂</option>
                  {factories.filter(f => f.status === 'active').map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pm-label">截止日期</label>
                <input className="pm-input" type="date" value={taskForm.deadline} onChange={e => setTaskForm({ ...taskForm, deadline: e.target.value })} />
              </div>
              <div>
                <label className="pm-label">试卷份数</label>
                <input className="pm-input" type="number" value={taskForm.paper_count} onChange={e => setTaskForm({ ...taskForm, paper_count: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="pm-label">答题卡份数</label>
                <input className="pm-input" type="number" value={taskForm.answer_sheet_count} onChange={e => setTaskForm({ ...taskForm, answer_sheet_count: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="pm-label">试卷纸张类型</label>
                <select className="pm-input" value={taskForm.paper_type} onChange={e => setTaskForm({ ...taskForm, paper_type: e.target.value })}>
                  <option>A3</option><option>A4</option><option>B4</option><option>B5</option><option>8K</option><option>16K</option>
                </select>
              </div>
              <div>
                <label className="pm-label">答题卡纸张类型</label>
                <select className="pm-input" value={taskForm.answer_sheet_type} onChange={e => setTaskForm({ ...taskForm, answer_sheet_type: e.target.value })}>
                  <option>A3</option><option>A4</option><option>B4</option><option>B5</option><option>8K</option><option>16K</option>
                </select>
              </div>
              <div>
                <label className="pm-label">联系电话</label>
                <input className="pm-input" value={taskForm.contact_phone} onChange={e => setTaskForm({ ...taskForm, contact_phone: e.target.value })} placeholder="效果确认电话" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={taskForm.confidentiality_enabled} onChange={e => setTaskForm({ ...taskForm, confidentiality_enabled: e.target.checked })} />
                <label style={{ fontSize: '13px', color: '#475569' }}>启用保密性（审核过程不允许预览）</label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="pm-label">装订要求</label>
                <textarea className="pm-input" rows={2} value={taskForm.binding_requirement} onChange={e => setTaskForm({ ...taskForm, binding_requirement: e.target.value })} placeholder="如: 左侧装订, 每50份一包" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="pm-label">分装要求</label>
                <textarea className="pm-input" rows={2} value={taskForm.packaging_requirement} onChange={e => setTaskForm({ ...taskForm, packaging_requirement: e.target.value })} placeholder="如: 按考场分装, 每考场单独包装" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="pm-btn pm-btn-secondary" onClick={() => setShowTaskModal(false)}>取消</button>
              <button className="pm-btn pm-btn-primary" onClick={handleCreateTask} disabled={!taskForm.title}>创建任务</button>
            </div>
          </div>
        </div>
      )}

      {/* 印厂弹窗 */}
      {showFactoryModal && (
        <div className="pm-modal-overlay" onClick={() => setShowFactoryModal(false)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600 }}>{editingFactory ? '编辑印厂' : '添加印厂'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="pm-label">印厂名称 *</label>
                <input className="pm-input" value={factoryForm.name} onChange={e => setFactoryForm({ ...factoryForm, name: e.target.value })} placeholder="如: 学校印刷厂" />
              </div>
              <div>
                <label className="pm-label">印刷管理员</label>
                <input className="pm-input" value={factoryForm.manager_id} onChange={e => setFactoryForm({ ...factoryForm, manager_id: e.target.value })} placeholder="管理员ID" />
              </div>
              <div>
                <label className="pm-label">审核员</label>
                <input className="pm-input" value={factoryForm.reviewer_id} onChange={e => setFactoryForm({ ...factoryForm, reviewer_id: e.target.value })} placeholder="审核员ID" />
              </div>
              <div>
                <label className="pm-label">联系电话</label>
                <input className="pm-input" value={factoryForm.contact_phone} onChange={e => setFactoryForm({ ...factoryForm, contact_phone: e.target.value })} />
              </div>
              <div>
                <label className="pm-label">地址</label>
                <input className="pm-input" value={factoryForm.address} onChange={e => setFactoryForm({ ...factoryForm, address: e.target.value })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={factoryForm.support_binding} onChange={e => setFactoryForm({ ...factoryForm, support_binding: e.target.checked })} />
                <label style={{ fontSize: '13px' }}>支持装订</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={factoryForm.support_packaging} onChange={e => setFactoryForm({ ...factoryForm, support_packaging: e.target.checked })} />
                <label style={{ fontSize: '13px' }}>支持分装</label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="pm-label">支持纸张类型 (逗号分隔)</label>
                <input className="pm-input" value={(factoryForm.paper_types || []).join(',')} onChange={e => setFactoryForm({ ...factoryForm, paper_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="A3,A4,B4,B5,8K,16K" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="pm-btn pm-btn-secondary" onClick={() => setShowFactoryModal(false)}>取消</button>
              <button className="pm-btn pm-btn-primary" onClick={handleSaveFactory} disabled={!factoryForm.name}>{editingFactory ? '保存修改' : '添加印厂'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 领取记录弹窗 */}
      {showPickupModal && selectedTask && (
        <div className="pm-modal-overlay" onClick={() => setShowPickupModal(false)}>
          <div className="pm-modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600 }}>添加领取记录</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="pm-label">领取人姓名 *</label>
                <input className="pm-input" value={pickupForm.picker_name} onChange={e => setPickupForm({ ...pickupForm, picker_name: e.target.value })} />
              </div>
              <div>
                <label className="pm-label">领取部门</label>
                <input className="pm-input" value={pickupForm.picker_dept} onChange={e => setPickupForm({ ...pickupForm, picker_dept: e.target.value })} />
              </div>
              <div>
                <label className="pm-label">领取试卷数</label>
                <input className="pm-input" type="number" value={pickupForm.paper_count} onChange={e => setPickupForm({ ...pickupForm, paper_count: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="pm-label">领取答题卡数</label>
                <input className="pm-input" type="number" value={pickupForm.answer_sheet_count} onChange={e => setPickupForm({ ...pickupForm, answer_sheet_count: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="pm-btn pm-btn-secondary" onClick={() => setShowPickupModal(false)}>取消</button>
              <button className="pm-btn pm-btn-primary" onClick={handleAddPickup} disabled={!pickupForm.picker_name}>确认领取</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintManagement;
