const STATUS = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-soft)', ring: 'var(--warning-ring)', dot: true },
  running: { label: 'Running', color: 'var(--info)',    bg: 'var(--info-soft)',    ring: 'rgba(96,165,250,0.2)', dot: true },
  success: { label: 'Done',    color: 'var(--success)', bg: 'var(--success-soft)', ring: 'var(--success-ring)', dot: false },
  failed:  { label: 'Failed',  color: 'var(--error)',   bg: 'var(--error-soft)',   ring: 'var(--error-ring)',   dot: false },
};

const PROVIDER = {
  groq:       { label: 'Groq',        color: 'var(--teal)',  bg: 'var(--teal-soft)' },
  cerebras:   { label: 'Cerebras',    color: 'var(--amber)', bg: 'var(--amber-soft)' },
  gemini:     { label: 'Gemini',      color: 'var(--info)',  bg: 'var(--info-soft)' },
  openrouter: { label: 'OpenRouter',  color: 'var(--text-2)', bg: 'rgba(255,255,255,0.04)' },
};

const OP_LABEL = {
  summarize:'Summarize', extract_action_items:'Action Items',
  rewrite_formal:'Formal Rewrite', rewrite_casual:'Casual Rewrite',
  generate_linkedin_post:'LinkedIn Post', draft_email:'Draft Email',
  extract_key_decisions:'Key Decisions', explain_simply:'Explain Simply',
  generate_tweet_thread:'Tweet Thread', translate_hindi:'Translate Hindi',
  custom:'Custom',
};

const STATUS_BAR = {
  pending: 'var(--warning)',
  running: 'var(--info)',
  success: 'var(--success)',
  failed:  'var(--error)',
};

export default function TaskCard({ task, onClick }) {
  const s = STATUS[task.status] || STATUS.pending;
  const p = task.providerUsed ? PROVIDER[task.providerUsed] : null;
  const opLabel = OP_LABEL[task.operation] || task.operation;
  const barColor = STATUS_BAR[task.status] || 'var(--border-bright)';

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onClick(task)}
      onKeyDown={e => e.key === 'Enter' && onClick(task)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        minWidth: 0,
        width: '100%',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--surface-2)';
        e.currentTarget.style.borderColor = 'var(--border-bright)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--surface)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {/* Left status bar */}
      <div style={{ width: 3, background: barColor, flexShrink: 0 }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Row 1: title + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}>
            {task.title}
          </span>
          <span className="cx-pill" style={{ color: s.color, background: s.bg, border: `1px solid ${s.ring}` }}>
            {s.dot && (
              <span className="cx-blink" style={{
                display: 'inline-block', width: 5, height: 5,
                borderRadius: '50%', background: s.color, flexShrink: 0,
              }} />
            )}
            {s.label}
          </span>
        </div>

        {/* Row 2: operation + file badge + provider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>{opLabel}</span>
          {task.fileType && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'var(--accent)',
              background: 'var(--accent-soft)',
              border: '1px solid rgba(124,92,246,0.18)',
              borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em',
            }}>
              {task.fileType.toUpperCase()}
            </span>
          )}
          {p && (
            <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 600,
              color: p.color, background: p.bg,
              borderRadius: 4, padding: '1px 6px', flexShrink: 0,
            }}>
              {p.label}
            </span>
          )}
        </div>

        {/* Row 3: result preview */}
        {task.result && (
          <p style={{
            fontSize: 12,
            color: 'var(--text-2)',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingTop: 6,
            borderTop: '1px solid var(--divider)',
            margin: 0,
          }}>
            {task.result.replace(/\*/g, '').replace(/\n/g, ' ').trim()}
          </p>
        )}
      </div>
    </div>
  );
}