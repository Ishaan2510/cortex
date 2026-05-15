import { useState, useRef } from 'react';
import { createTask } from '../api/tasks';

const PRESET_OPS = [
  { value: 'summarize',             label: 'Summarize',            desc: 'Condense into key points' },
  { value: 'extract_action_items',  label: 'Extract Action Items', desc: 'Pull out tasks and next steps' },
  { value: 'rewrite_formal',        label: 'Rewrite — Formal',     desc: 'Refine to professional tone' },
  { value: 'rewrite_casual',        label: 'Rewrite — Casual',     desc: 'Make friendly and conversational' },
  { value: 'generate_linkedin_post',label: 'LinkedIn Post',        desc: 'Craft an engaging LinkedIn post' },
  { value: 'draft_email',           label: 'Draft Email',          desc: 'Write a polished email' },
  { value: 'extract_key_decisions', label: 'Key Decisions',        desc: 'Surface decisions and rationale' },
  { value: 'explain_simply',        label: 'Explain Simply',       desc: 'Simplify complex concepts' },
  { value: 'generate_tweet_thread', label: 'Tweet Thread',         desc: 'Convert ideas to a Twitter thread' },
  { value: 'translate_hindi',       label: 'Translate to Hindi',   desc: 'Translate content into Hindi' },
];

export default function TaskForm({ onTaskCreated }) {
  const [mode, setMode]             = useState('preset');
  const [operation, setOperation]   = useState('summarize');
  const [customPrompt, setCustom]   = useState('');
  const [title, setTitle]           = useState('');
  const [inputText, setInputText]   = useState('');
  const [file, setFile]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [dragOver, setDragOver]     = useState(false);
  const fileRef = useRef(null);

  const selectedOp = PRESET_OPS.find(op => op.value === operation);

  const applyFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.type.startsWith('image/')) {
      setError('Only PDF and image files are supported.'); return;
    }
    if (f.size > 10 * 1024 * 1024) { setError('File must be under 10 MB.'); return; }
    setFile(f); setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !file) { setError('Provide text or upload a file.'); return; }
    if (mode === 'custom' && !customPrompt.trim()) { setError('Enter a custom system prompt.'); return; }
    setError(''); setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim() || (mode === 'preset' ? selectedOp.label : 'Custom Task'));
      fd.append('operationType', mode);
      fd.append('operation', mode === 'preset' ? operation : 'custom');
      if (mode === 'custom') fd.append('customPrompt', customPrompt);
      if (inputText.trim()) fd.append('inputText', inputText);
      if (file) fd.append('file', file);
      const { data } = await createTask(fd);
      onTaskCreated(data);
      setTitle(''); setInputText(''); setFile(null); setCustom('');
      setOperation('summarize'); setMode('preset');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit task.');
    } finally { setLoading(false); }
  };

  const S = styles;

  return (
    <div className="cx-card cx-in" style={S.panel}>
      {/* Header */}
      <div style={S.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={S.iconWrap}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={S.panelTitle}>New Task</span>
        </div>
        <span style={S.panelSub}>Process text or files with AI</span>
      </div>

      <div style={S.divider} />

      <div style={{ padding: '0 20px 20px' }}>
        {/* Error */}
        {error && (
          <div style={{ ...S.errorBox, marginBottom: 14 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mode toggle */}
          <div className="cx-toggle">
            {['preset','custom'].map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`cx-toggle-btn${mode === m ? ' active' : ''}`}>
                {m === 'preset' ? 'Preset' : 'Custom Prompt'}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="cx-label">Title <span style={{ color: 'var(--text-3)', textTransform:'none', letterSpacing:0, fontWeight:400 }}>(optional)</span></label>
            <input className="cx-input" type="text" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={mode === 'preset' ? selectedOp?.label : 'My task'} />
          </div>

          {/* Preset dropdown */}
          {mode === 'preset' && (
            <div>
              <label className="cx-label">Operation</label>
              <select className="cx-input" value={operation} onChange={e => setOperation(e.target.value)}>
                {PRESET_OPS.map(op => (
                  <option key={op.value} value={op.value}>{op.label} — {op.desc}</option>
                ))}
              </select>
              {selectedOp && <p style={S.hint}>{selectedOp.desc}</p>}
            </div>
          )}

          {/* Custom prompt */}
          {mode === 'custom' && (
            <div>
              <label className="cx-label">System Prompt</label>
              <textarea className="cx-input" rows={3} value={customPrompt}
                onChange={e => setCustom(e.target.value)}
                placeholder="You are an expert analyst. Extract all financial metrics and present them in structured format..."
                style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
            </div>
          )}

          {/* Text input */}
          <div>
            <label className="cx-label">
              Text Input <span style={{ color:'var(--text-3)', textTransform:'none', letterSpacing:0, fontWeight:400 }}>(optional if file attached)</span>
            </label>
            <textarea className="cx-input" rows={4} value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Paste your content here..."
              style={{ resize: 'vertical' }} />
          </div>

          {/* File upload */}
          <div>
            <label className="cx-label">File <span style={{ color:'var(--text-3)', textTransform:'none', letterSpacing:0, fontWeight:400 }}>PDF or image · max 10 MB</span></label>
            {file ? (
              <div style={S.fileAttached}>
                <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{flexShrink:0}}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span style={{ fontSize:13, color:'var(--text)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</span>
                  <span style={{ fontSize:11, color:'var(--text-2)', flexShrink:0 }}>{(file.size/1024).toFixed(0)} KB</span>
                </div>
                <button type="button" onClick={() => setFile(null)} style={S.removeBtn} aria-label="Remove file">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <div
                role="button" tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); applyFile(e.dataTransfer.files[0]); }}
                style={{ ...S.dropZone, borderColor: dragOver ? 'var(--accent)' : 'rgba(255,255,255,0.1)', background: dragOver ? 'var(--accent-soft)' : 'transparent' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" style={{margin:'0 auto 7px', display:'block'}}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p style={{ fontSize:13, color:'var(--text-2)', textAlign:'center' }}>
                  Drop file or <span style={{ color:'var(--accent)', fontWeight:500 }}>browse</span>
                </p>
                <p style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', marginTop:3 }}>PDF · JPEG · PNG · WebP</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display:'none' }}
              onChange={e => applyFile(e.target.files[0])} />
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="cx-btn" style={{ width:'100%', padding:'11px' }}>
            {loading
              ? <><span className="cx-spin" style={S.spinner} />Running…</>
              : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Run Task
                </>
            }
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  panel: { overflow:'hidden' },
  panelHeader: { padding:'18px 20px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6 },
  panelTitle: { fontFamily:'var(--font-display)', fontWeight:700, fontSize:17, color:'var(--text)' },
  panelSub: { fontSize:12, color:'var(--text-2)' },
  iconWrap: {
    width:28, height:28, borderRadius:8,
    background:'var(--accent-soft)', border:'1px solid rgba(124,92,246,0.18)',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  divider: { borderTop:'1px solid var(--border)', margin:'0 0 16px' },
  errorBox: {
    display:'flex', alignItems:'flex-start', gap:8,
    background:'var(--error-soft)', border:'1px solid var(--error-ring)',
    borderRadius:9, padding:'9px 12px',
    fontSize:13, color:'var(--error)',
  },
  hint: { fontSize:12, color:'var(--text-2)', marginTop:5, paddingLeft:1 },
  fileAttached: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    background:'var(--accent-soft)', border:'1px solid rgba(124,92,246,0.2)',
    borderRadius:9, padding:'9px 12px',
  },
  removeBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--text-2)', padding:3, display:'flex', alignItems:'center', flexShrink:0,
  },
  dropZone: {
    border:'1.5px dashed', borderRadius:9, padding:'18px 12px', cursor:'pointer',
    transition:'border-color 0.15s, background 0.15s',
  },
  spinner: {
    display:'inline-block', width:14, height:14,
    border:'2px solid rgba(255,255,255,0.25)', borderTopColor:'#fff',
    borderRadius:'50%',
  },
};