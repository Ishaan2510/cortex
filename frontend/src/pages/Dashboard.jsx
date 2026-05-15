import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import { getTasks } from '../api/tasks';
import TaskForm from '../components/TaskForm';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks]           = useState([]);
  const [selectedTask, setSelected] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  const fetchTasks = useCallback(async (p = 1, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await getTasks(p);
      const taskList = Array.isArray(data) ? data : (data.tasks || []);
      setTasks(taskList);
      setTotalPages(data.pages || 1);
      setTotal(data.total ?? taskList.length);
      setPage(data.page || p);
    } catch { /* 401 handled by axios interceptor */ }
    finally { if (!silent) setLoading(false); }
  }, []);

  // Initial load + silent background poll every 5 s
  useEffect(() => {
    fetchTasks(page);
    const iv = setInterval(() => fetchTasks(page, true), 5000);
    return () => clearInterval(iv);
  }, [fetchTasks, page]);

  const handleTaskCreated = (newTask) => {
    setTasks(prev => [newTask, ...prev]);
    setSelected(newTask);
    setTotal(t => t + 1);
  };

  return (
    <div style={{ height:'100vh', overflow:'hidden', background:'var(--bg)', color:'var(--text)', fontFamily:'var(--font-body)' }}>

      {/* Ambient glow — top-left only, subtle */}
      <div style={{
        position:'fixed', top:0, left:0, width:500, height:500,
        background:'radial-gradient(ellipse at 15% 15%, rgba(124,92,246,0.055) 0%, transparent 70%)',
        pointerEvents:'none', zIndex:0,
      }} />

      {/* ── Header ── */}
      <header style={{
        position:'sticky', top:0, zIndex:30,
        background:'rgba(15,14,12,0.88)',
        backdropFilter:'blur(14px)',
        borderBottom:'1px solid var(--border)',
      }}>
        <div style={{
          maxWidth:1120, margin:'0 auto', padding:'0 24px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          height:56,
        }}>
          {/* Wordmark */}
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{
              width:26, height:26, borderRadius:7,
              background:'var(--accent)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:17, color:'var(--text)', letterSpacing:'-0.01em' }}>
              Cortex
            </span>
          </div>

          {/* Right cluster */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {total > 0 && (
              <span style={{ fontSize:12, color:'var(--text-2)' }}>
                {total} task{total !== 1 ? 's' : ''}
              </span>
            )}
            <span style={{ fontSize:12, color:'var(--text-2)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.email}
            </span>
            <button className="cx-ghost" onClick={() => { logout(); navigate('/login'); }} style={{ fontSize:12, padding:'5px 12px' }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main two-column layout ── */}
      <main style={{
        position:'relative', zIndex:1,
        maxWidth:1120, margin:'0 auto', padding:'22px 24px',
        height:'calc(100vh - 56px)', overflow:'hidden',
      }}>
        <div style={{
          display:'grid', gridTemplateColumns:'370px 1fr',
          gap:22, height:'100%', alignItems:'start',
        }}>

          {/* ── Left: form, independently scrollable ── */}
          <div style={{ height:'calc(100vh - 100px)', overflowY:'auto', paddingRight:4 }}>
            <TaskForm onTaskCreated={handleTaskCreated} />
          </div>

          {/* ── Right: task list, independently scrollable ── */}
          <div style={{ height:'calc(100vh - 100px)', overflowY:'auto', display:'flex', flexDirection:'column', gap:0 }}>

            {/* List header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexShrink:0 }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:15, color:'var(--text)', margin:0 }}>
                Your Tasks
              </h2>
              {!loading && (
                <button
                  className="cx-ghost"
                  onClick={() => fetchTasks(page)}
                  style={{ fontSize:11, padding:'4px 11px', display:'flex', alignItems:'center', gap:5 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Refresh
                </button>
              )}
            </div>

            {/* Content area */}
            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{
                    background:'var(--surface)', border:'1px solid var(--border)',
                    borderRadius:12, height:68, opacity:0.4 - i*0.08,
                  }} />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <Empty />
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                {tasks.map((task, i) => (
                  <div key={task._id} className="cx-in" style={{ animationDelay:`${i * 0.03}s` }}>
                    <TaskCard task={task} onClick={setSelected} />
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:18, paddingTop:14, borderTop:'1px solid var(--divider)' }}>
                    <button className="cx-ghost" disabled={page <= 1}
                      onClick={() => fetchTasks(page - 1)}
                      style={{ fontSize:12, padding:'5px 12px' }}>
                      ← Prev
                    </button>
                    <span style={{ fontSize:12, color:'var(--text-2)' }}>{page} / {totalPages}</span>
                    <button className="cx-ghost" disabled={page >= totalPages}
                      onClick={() => fetchTasks(page + 1)}
                      style={{ fontSize:12, padding:'5px 12px' }}>
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <TaskModal task={selectedTask} onClose={() => setSelected(null)} />
    </div>
  );
}

function Empty() {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      flex:1, padding:'48px 24px',
      background:'var(--surface)', border:'1px dashed var(--border)',
      borderRadius:14, textAlign:'center',
    }}>
      <div style={{
        width:38, height:38, borderRadius:10,
        background:'var(--accent-soft)',
        border:'1px solid rgba(124,92,246,0.18)',
        display:'flex', alignItems:'center', justifyContent:'center',
        marginBottom:12,
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:15, color:'var(--text)', margin:'0 0 4px' }}>
        No tasks yet
      </p>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:0 }}>
        Create your first task on the left
      </p>
    </div>
  );
}