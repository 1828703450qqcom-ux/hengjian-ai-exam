import { useState } from 'react'
import { PageHeader, Tag, toast } from '../components/ui'

const POSTS = [
  { id: 1, title: '大学英语四级考试有什么备考技巧？', author: '张三', category: '英语', replies: 23, views: 456, likes: 45, is_pinned: true, is_solved: true, create_time: '2026-06-20 14:30' },
  { id: 2, title: '高等数学积分计算总是出错，求大神指点！', author: '李四', category: '数学', replies: 15, views: 234, likes: 28, is_pinned: false, is_solved: true, create_time: '2026-06-22 10:15' },
  { id: 3, title: '计算机二级Python考试经验分享', author: '王五', category: '计算机', replies: 34, views: 678, likes: 67, is_pinned: true, is_solved: false, create_time: '2026-06-25 16:45' },
  { id: 4, title: '思政课期末考试重点整理', author: '赵六', category: '思政', replies: 12, views: 345, likes: 23, is_pinned: false, is_solved: false, create_time: '2026-06-28 09:20' },
  { id: 5, title: '英语口语怎么练习比较有效？', author: '钱七', category: '英语', replies: 18, views: 289, likes: 31, is_pinned: false, is_solved: true, create_time: '2026-07-01 11:30' },
]

const REPLIES = [
  { id: 1, author: '王老师', content: '四级备考建议：1. 每天背50个单词，重点记忆高频词汇；2. 每周做2套真题，严格控制时间；3. 听力每天练习30分钟，可以听VOA慢速英语；4. 作文背诵10篇范文，掌握常用句型。坚持1个月肯定能过！', time: '2026-06-20 15:00', is_teacher: true, likes: 34, is_best: true },
  { id: 2, author: '学霸小明', content: '补充一下：阅读理解要先看题目再读文章，带着问题找答案，效率会高很多。翻译题要注意语法正确，不会的词用简单词代替，不要留空。', time: '2026-06-20 16:20', is_teacher: false, likes: 18 },
  { id: 3, author: '过儿', content: '亲测有效！按照这个方法复习了一个月，四级考了528分，感谢分享！', time: '2026-06-21 09:15', is_teacher: false, likes: 12 },
]

export default function Forum() {
  const [activeTab, setActiveTab] = useState('list') // list / detail / create
  const [selectedPost, setSelectedPost] = useState(null)
  const [filterCategory, setFilterCategory] = useState('全部')
  const [replyContent, setReplyContent] = useState('')

  const categories = ['全部', '英语', '数学', '计算机', '思政', '其他']

  const filteredPosts = POSTS.filter(p => filterCategory === '全部' || p.category === filterCategory)

  const openPost = (post) => {
    setSelectedPost(post)
    setActiveTab('detail')
  }

  return (
    <div>
      <PageHeader
        title="💬 论坛与问答社区"
        subtitle="学生提问 · 教师解答 · 知识点讨论 · 经验分享"
        right={
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            {[['list', '📋 帖子列表'], ['create', '✏️ 发帖提问']].map(([key, label]) => (
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
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6 }}>📝 帖子总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>3,456</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: 12, padding: '16px 18px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>✅ 已解决</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>2,890</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, padding: '16px 18px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>👥 活跃用户</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>1,234</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 12, padding: '16px 18px', border: '1px solid #c4b5fd' }}>
          <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 6 }}>💬 今日新帖</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#5b21b6' }}>56</div>
        </div>
      </div>

      {/* 帖子列表 */}
      {activeTab === 'list' && (
        <div className="card">
          <div className="card-title">
            <span>📋 帖子列表</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setFilterCategory(cat)}
                    style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, cursor: 'pointer', border: 'none', background: filterCategory === cat ? '#3b82f6' : '#f1f5f9', color: filterCategory === cat ? '#fff' : '#6b7280' }}>
                    {cat}
                  </button>
                ))}
              </div>
              <button className="btn sm primary" onClick={() => setActiveTab('create')}>+ 发帖提问</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredPosts.map(post => (
              <div key={post.id} onClick={() => openPost(post)}
                style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer', borderLeft: post.is_pinned ? '4px solid #f59e0b' : '4px solid transparent' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {post.is_pinned && <Tag color="orange" style={{ fontSize: 10 }}>📌 置顶</Tag>}
                    {post.is_solved && <Tag color="green" style={{ fontSize: 10 }}>✅ 已解决</Tag>}
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>{post.title}</span>
                  </div>
                  <Tag color="blue" style={{ fontSize: 10 }}>{post.category}</Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#6b7280' }}>
                  <span>👤 {post.author}</span>
                  <span>💬 {post.replies} 回复</span>
                  <span>👁️ {post.views} 浏览</span>
                  <span>👍 {post.likes} 点赞</span>
                  <span style={{ marginLeft: 'auto' }}>{post.create_time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 帖子详情 */}
      {activeTab === 'detail' && selectedPost && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 280px', gap: 16 }}>
          <div>
            {/* 帖子内容 */}
            <div className="card mb16">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {selectedPost.is_pinned && <Tag color="orange">📌 置顶</Tag>}
                {selectedPost.is_solved && <Tag color="green">✅ 已解决</Tag>}
                <Tag color="blue">{selectedPost.category}</Tag>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{selectedPost.title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{selectedPost.author.charAt(0)}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedPost.author}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{selectedPost.create_time}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                  <span>👁️ {selectedPost.views}</span>
                  <span>👍 {selectedPost.likes}</span>
                </div>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: '#4b5563' }}>
                <p>各位同学好，我最近在备考{selectedPost.category}，但是遇到了一些困难，想请教一下大家有什么好的学习方法和经验？</p>
                <p>具体问题：</p>
                <p>1. 知识点太多，不知道从哪里开始复习</p>
                <p>2. 做题总是出错，正确率提不上去</p>
                <p>3. 时间不够用，考试总是做不完</p>
                <p>希望有经验的同学和老师能分享一下备考经验，非常感谢！</p>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn sm" onClick={() => toast.success('已点赞')}>👍 点赞</button>
                <button className="btn sm" onClick={() => toast.success('已收藏')}>⭐ 收藏</button>
                <button className="btn sm" onClick={() => toast.success('已分享')}>🔗 分享</button>
              </div>
            </div>

            {/* 回复列表 */}
            <div className="card">
              <div className="card-title"><span>💬 全部回复 ({REPLIES.length})</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {REPLIES.map(reply => (
                  <div key={reply.id} style={{ padding: 14, background: reply.is_best ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${reply.is_best ? '#bbf7d0' : '#e5e7eb'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: reply.is_teacher ? '#f59e0b' : '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{reply.author.charAt(0)}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {reply.author}
                          {reply.is_teacher && <Tag color="orange" style={{ fontSize: 9 }}>👨‍🏫 教师</Tag>}
                          {reply.is_best && <Tag color="green" style={{ fontSize: 9 }}>🏆 最佳答案</Tag>}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{reply.time}</div>
                      </div>
                      <div style={{ marginLeft: 'auto' }}>
                        <button className="btn sm" style={{ fontSize: 11 }} onClick={() => toast.success('已点赞')}>👍 {reply.likes}</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: '#4b5563' }}>{reply.content}</div>
                  </div>
                ))}
              </div>

              {/* 发表回复 */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>✏️ 发表回复</div>
                <textarea className="input" placeholder="输入你的回复内容..." rows={4} value={replyContent} onChange={e => setReplyContent(e.target.value)} style={{ marginBottom: 10 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm">😊 表情</button>
                    <button className="btn sm">🖼️ 图片</button>
                    <button className="btn sm">📎 附件</button>
                  </div>
                  <button className="btn primary" onClick={() => { if (replyContent.trim()) { toast.success('回复发表成功'); setReplyContent('') } else { toast.warning('请输入回复内容') } }}>发表回复</button>
                </div>
              </div>
            </div>
          </div>

          {/* 侧边栏 */}
          <div>
            <div className="card mb16">
              <div className="card-title"><span>🔥 热门帖子</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {POSTS.slice(0, 5).map((post, i) => (
                  <div key={post.id} onClick={() => openPost(post)} style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? '#ef4444' : '#9ca3af', minWidth: 20 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 12, color: '#1f2937', lineHeight: 1.4 }}>{post.title}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{post.replies}回复 · {post.views}浏览</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title"><span>🏆 活跃用户榜</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['学霸小明', '王老师', '过儿', '李四', '张三'].map((user, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? '#f59e0b' : '#9ca3af', minWidth: 20 }}>{i + 1}</span>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'][i], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{user.charAt(0)}</div>
                    <span style={{ fontSize: 13 }}>{user}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>{[156, 134, 98, 87, 76][i]}帖</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 发帖 */}
      {activeTab === 'create' && (
        <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
          <div className="card-title"><span>✏️ 发布新帖</span></div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>帖子分类</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {categories.filter(c => c !== '全部').map(cat => (
                <button key={cat} className="btn sm">{cat}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>帖子标题</label>
            <input className="input" placeholder="请输入帖子标题（5-50字）" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>帖子内容</label>
            <textarea className="input" placeholder="请详细描述你的问题或分享内容..." rows={8} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>添加标签（选填）</label>
            <input className="input" placeholder="输入标签，用逗号分隔" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn primary" onClick={() => { toast.success('帖子发布成功'); setActiveTab('list') }}>发布帖子</button>
            <button className="btn" onClick={() => toast.success('已保存为草稿')}>保存草稿</button>
          </div>
        </div>
      )}
    </div>
  )
}
