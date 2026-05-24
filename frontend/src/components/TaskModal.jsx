import { useEffect, useState } from 'react';
import { getTask } from '../api/tasks';

const STATUS = {
  pending: { label: 'Pending', color: 'var(--warning)' },
  running: { label: 'Running', color: 'var(--info)' },
  success: { label: 'Completed', color: 'var(--success)' },
  failed:  { label: 'Failed', color: 'var(--error)' },
};

const PROVIDER_COLOR = {
  groq: 'var(--teal)', cerebras: 'var(--amber)', gemini: 'var(--info)', openrouter: 'var(--text-2)',
};
const PROVIDER_LABEL = {
  groq:'Groq', cerebras:'Cerebras', gemini:'Gemini', openrouter:'OpenRouter',
};
const OP_LABEL = {
  summarize:'Summarize', extract_action_items:'Extract Action Items',
  rewrite_formal:'Rewrite — Formal', rewrite_casual:'Rewrite — Casual',
  generate_linkedin_post:'LinkedIn Post', draft_email:'Draft Email',
  extract_key_decisions:'Key Decisions', explain_simply:'Explain Simply',
  generate_tweet_thread:'Tweet Thread', translate_hindi:'Translate to Hindi',
  custom:'Custom Prompt',
};

/* ── Minimal inline markdown → JSX ─────────────────── */
function Prose({ text }) {
  if (!text) return null;

  const bold = (raw) =>
    raw.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i}>{p.slice(2, -2)}</strong>
        : p
    );

  const lines = text.split('\n');
  const out   = [];
  let list    = [];
  let k       = 0;

  const flush = () => {
    if (!list.length) return;
    out.push(<ul key={k++} style={{ listStyle:'none', padding:0, margin:'4px 0 8px', display:'flex', flexDirection:'column', gap:4 }}>
      {list.map((li, i) => (
        <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
          <span style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:'var(--accent)', flexShrink:0, marginTop:9 }} />
          <span style={{ fontSize:14, color:'var(--text)', lineHeight:1.65 }}>{bold(li)}</span>
        </li>
      ))}
    </ul>);
    list = [];
  };

  lines.forEach(line => {
    const t = line.trim();
    if (t.startsWith('* ') || t.startsWith('- ')) {
      list.push(t.slice(2));
    } else if (t.startsWith('### ')) {
      flush(); out.push(<p key={k++} style={{ fontSize:13, fontWeight:600, color:'var(--text)', margin:'12px 0 4px' }}>{t.slice(4)}</p>);
    } else if (t.startsWith('## ')) {
      flush(); out.push(<p key={k++} style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:700, color:'var(--text)', margin:'14px 0 5px' }}>{t.slice(3)}</p>);
    } else if (t.startsWith('# ')) {
      flush(); out.push(<p key={k++} style={{ fontFamily:'var(--font-display)', fontSize:17, fontWeight:700, color:'var(--text)', margin:'14px 0 6px' }}>{t.slice(2)}</p>);
    } else if (t === '') {
      flush(); out.push(<div key={k++} style={{ height:4 }} />);
    } else {
      flush(); out.push(<p key={k++} style={{ fontSize:14, color:'var(--text)', lineHeight:1.68, margin:'0 0 6px' }}>{bold(t)}</p>);
    }
  });
  flush();
  return <>{out}</>;
}

/* ── Copy button ─────────────────────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} className="cx-ghost" style={{ fontSize:12, padding:'5px 11px', marginTop:8 }}>
      {copied
        ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
        : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
      }
    </button>
  );
}

/* ── Section wrapper ─────────────────────────────── */
function Section({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
      <span style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</span>
      {children}
    </div>
  );
}

/* ── Main component ──────────────────────────────── */
export default function TaskModal({ task, onClose }) {
  const [detail, setDetail] = useState(task);

  useEffect(() => {
    if (!task) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(task);
    if (task.status !== 'pending' && task.status !== 'running') return;
    const iv = setInterval(async () => {
      try {
        const { data } = await getTask(task._id);
        setDetail(data);
        if (data.status === 'success' || data.status === 'failed') clearInterval(iv);
      } catch { clearInterval(iv); }
    }, 3000);
    return () => clearInterval(iv);
  }, [task]);

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!task || !detail) return null;

  const s = STATUS[detail.status] || STATUS.pending;
  const isWaiting = detail.status === 'pending' || detail.status === 'running';
  const opLabel = OP_LABEL[detail.operation] || detail.operation;

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}
      onClick={onClose}
    >
      <div
        className="cx-card cx-in"
        style={{ width:'100%', maxWidth:540, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:17, color:'var(--text)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {detail.title}
              </h2>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'var(--text-2)' }}>{opLabel}</span>
                {detail.fileType && (
                  <span style={{ fontSize:10, fontWeight:700, color:'var(--accent)', background:'var(--accent-soft)', borderRadius:4, padding:'1px 6px' }}>
                    {detail.fileType.toUpperCase()}
                  </span>
                )}
                <span style={{ fontSize:12, fontWeight:600, color:s.color, display:'flex', alignItems:'center', gap:5 }}>
                  {isWaiting && <span className="cx-blink" style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:s.color }} />}
                  {s.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose} aria-label="Close"
              className="cx-ghost"
              style={{ padding:'5px 8px', flexShrink:0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY:'auto', flex:1, padding:'18px 20px', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Provider chain */}
          {detail.providerChain?.length > 0 && (
            <Section label="Provider Chain">
              <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                {detail.providerChain.map((p, i) => {
                  const color = PROVIDER_COLOR[p] || 'var(--text-2)';
                  const label = PROVIDER_LABEL[p] || p;
                  const isFinal = detail.providerUsed === p;
                  return (
                    <span key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{
                        fontSize:11, fontWeight:600, color,
                        background: isFinal ? 'var(--success-soft)' : 'var(--surface-2)',
                        border: `1px solid ${isFinal ? 'var(--success-ring)' : 'var(--border)'}`,
                        borderRadius:5, padding:'3px 8px',
                      }}>
                        {label}{isFinal && ' ✓'}
                      </span>
                      {i < detail.providerChain.length - 1 && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      )}
                    </span>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Input text */}
          {detail.inputText && (
            <Section label="Input">
              <div style={{
                background:'var(--surface-2)', border:'1px solid var(--border)',
                borderRadius:9, padding:'11px 13px',
                fontSize:13, color:'var(--text-2)', lineHeight:1.65,
                fontFamily:'var(--font-mono)', maxHeight:110, overflowY:'auto',
                wordBreak:'break-word',
              }}>
                {detail.inputText}
              </div>
            </Section>
          )}

          {/* Waiting */}
          {isWaiting && (
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:12,
              padding:'28px 16px',
              background:'var(--surface-2)', border:'1px solid var(--border)',
              borderRadius:12,
            }}>
              <div style={{ display:'flex', gap:5 }}>
                {[0,1,2].map(i => (
                  <span key={i} className="cx-blink" style={{
                    display:'inline-block', width:7, height:7, borderRadius:'50%',
                    background:'var(--accent)', animationDelay:`${i*0.22}s`,
                  }} />
                ))}
              </div>
              <p style={{ fontSize:13, color:'var(--text-2)', margin:0 }}>
                {detail.status === 'pending' ? 'Queued — waiting for worker' : 'AI is processing…'}
              </p>
            </div>
          )}

          {/* Result */}
          {detail.result && (
            <Section label="Result">
              <div style={{
                background:'var(--surface-2)',
                border:'1px solid rgba(74,222,128,0.15)',
                borderRadius:10, padding:'14px 15px',
              }}>
                <Prose text={detail.result} />
              </div>
              <CopyBtn text={detail.result} />
            </Section>
          )}

          {/* Logs */}
          {detail.logs?.length > 0 && (
            <Section label="Execution Log">
              <div style={{
                background:'#0a0909', border:'1px solid var(--border)',
                borderRadius:9, padding:'11px 13px',
                display:'flex', flexDirection:'column', gap:3,
              }}>
                {detail.logs.map((log, i) => (
                  <p key={i} style={{
                    fontFamily:'var(--font-mono)', fontSize:11,
                    color: log.includes('ERROR') ? 'var(--error)' : 'var(--text-2)',
                    lineHeight:1.55, margin:0, wordBreak:'break-all',
                  }}>
                    {log}
                  </p>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}