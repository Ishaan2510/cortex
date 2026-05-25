import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const GITHUB_URL = 'https://github.com/Ishaan2510/cortex';

const OPERATIONS = [
  { n: '01', name: 'Summarize',            desc: 'Condense long text into 3–5 bullet points.' },
  { n: '02', name: 'Extract action items', desc: 'Pull tasks and follow-ups out of meeting notes or threads.' },
  { n: '03', name: 'Rewrite — formal',     desc: 'Lift casual writing into a professional register.' },
  { n: '04', name: 'Rewrite — casual',     desc: 'Make stiff corporate prose feel warm and human.' },
  { n: '05', name: 'LinkedIn post',        desc: 'Hook, value in the body, and a CTA — under 300 words.' },
  { n: '06', name: 'Draft email',          desc: 'Subject line, greeting, concise body, sign-off.' },
  { n: '07', name: 'Key decisions',        desc: 'Surface decisions made and open questions left.' },
  { n: '08', name: 'Explain simply',       desc: 'Strip the jargon; use analogies a teenager would get.' },
  { n: '09', name: 'Tweet thread',         desc: 'Numbered thread starting with a hook tweet.' },
  { n: '10', name: 'Translate to Hindi',   desc: 'Devanagari script with natural, fluent phrasing.' },
];

const ROUTING_STEPS = [
  { kind: 'cmd',  text: '$ POST /api/tasks  { operation: "summarize" }', delay: 600 },
  { kind: 'info', text: '  routing: short input · text only',            delay: 500 },
  { kind: 'try',  text: '> trying provider: groq',                       delay: 700 },
  { kind: 'warn', text: '  rate limit on groq, falling through',         delay: 750 },
  { kind: 'try',  text: '> trying provider: cerebras',                   delay: 750 },
  { kind: 'ok',   text: '  success with provider: cerebras  (1.3s)',     delay: 600 },
  { kind: 'done', text: '$ 200 OK · 412 tokens · chain: groq→cerebras',  delay: 600 },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return (
    <div style={{
      background: 'var(--bg)', color: 'var(--text)',
      minHeight: '100vh', fontFamily: 'var(--font-body)',
      position: 'relative', overflow: 'hidden',
    }}>
      <AmbientGlow />
      <Nav />
      <Hero />
      <RoutingDemo />
      <Operations />
      <Topologies />
      <TechStrip />
      <Footer />
    </div>
  );
}

/* ───────────────────── Background atmosphere ───────────────────── */

function AmbientGlow() {
  return (
    <>
      <div aria-hidden style={{
        position: 'absolute', top: -240, right: -180, width: 680, height: 680,
        background: 'radial-gradient(circle at 50% 50%, rgba(124,92,246,0.07) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0, filter: 'blur(8px)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', top: 680, left: -200, width: 540, height: 540,
        background: 'radial-gradient(circle at 50% 50%, rgba(45,212,191,0.035) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
    </>
  );
}

/* ───────────────────── Reusable pieces ───────────────────── */

function Logo({ size = 26 }) {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
      <div style={{
        width: size, height: size, borderRadius: 7, background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 17, color: 'var(--text)', letterSpacing: '-0.01em',
      }}>
        Cortex
      </span>
    </Link>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
      <span aria-hidden style={{ width: 24, height: 1, background: 'var(--accent)', flexShrink: 0 }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
        color: 'var(--text-2)', letterSpacing: '0.14em', textTransform: 'uppercase',
      }}>
        {children}
      </span>
    </div>
  );
}

function SectionHeading({ children, max = 720 }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)', fontWeight: 600,
      fontSize: 'clamp(26px, 3.4vw, 38px)', lineHeight: 1.15,
      letterSpacing: '-0.022em', color: 'var(--text)',
      margin: '0 0 14px', maxWidth: max,
    }}>
      {children}
    </h2>
  );
}

function SectionBlurb({ children, max = 640 }) {
  return (
    <p style={{
      fontSize: 16, lineHeight: 1.65, color: 'var(--text-2)',
      margin: '0 0 36px', maxWidth: max,
    }}>
      {children}
    </p>
  );
}

/* ───────────────────── Nav ───────────────────── */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: scrolled ? 'rgba(15,14,12,0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'transparent'}`,
      transition: 'background 0.2s, border-color 0.2s, backdrop-filter 0.2s',
    }}>
      <div style={{
        maxWidth: 1120, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
      }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* <a href={GITHUB_URL} target="_blank" rel="noreferrer"
             className="cx-ghost" style={{ fontSize: 13, padding: '6px 13px' }}>
            GitHub
          </a> */}
          <Link to="/login" className="cx-ghost" style={{ fontSize: 13, padding: '6px 13px' }}>
            Sign in
          </Link>
          <Link to="/register" className="cx-btn" style={{ fontSize: 13, padding: '7px 15px' }}>
            Try the demo
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ───────────────────── Hero ───────────────────── */

function Hero() {
  return (
    <section style={{
      position: 'relative', zIndex: 1,
      maxWidth: 1120, margin: '0 auto', padding: '96px 24px 72px',
    }}>
      <div style={{ maxWidth: 820 }} className="cx-in">
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 600,
          fontSize: 'clamp(46px, 7.4vw, 84px)', lineHeight: 0.97,
          letterSpacing: '-0.028em', color: 'var(--text)',
          margin: '0 0 26px',
        }}>
          Multi-provider<br />
          <span style={{ fontStyle: 'italic', color: 'var(--text)' }}>AI tasks.</span>
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 1.5vw, 19px)', lineHeight: 1.6,
          color: 'var(--text-2)', margin: '0 0 34px', maxWidth: 640,
        }}>
          Cortex routes every request across <Strong>Groq</Strong>, <Strong>Cerebras</Strong>,{' '}
          <Strong>Gemini</Strong>, and <Strong>OpenRouter</Strong> with automatic fallback on
          rate limits. Ten preset operations, custom prompts, text and PDF input — all from
          one workspace.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/register" className="cx-btn" style={{ fontSize: 14, padding: '12px 22px' }}>
            Try the demo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginLeft: 2 }}>
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer"
             className="cx-ghost" style={{ fontSize: 14, padding: '12px 22px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.06-.02-2.08-3.34.72-4.04-1.61-4.04-1.61-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.22.7.83.58C20.57 21.79 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            View source
          </a>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 4, fontSize: 12, color: 'var(--text-2)' }}>
            <span className="cx-blink" style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: 'var(--success)',
            }} />
            Live on free-tier infra
          </span>
        </div>
      </div>
    </section>
  );
}

function Strong({ children }) {
  return <span style={{ color: 'var(--text)', fontWeight: 500 }}>{children}</span>;
}

/* ───────────────────── Routing demo (animated terminal) ───────────────────── */

function RoutingDemo() {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    if (visibleSteps >= ROUTING_STEPS.length) {
      const t = setTimeout(() => setVisibleSteps(0), 3200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setVisibleSteps(v => v + 1),
      ROUTING_STEPS[visibleSteps]?.delay || 500
    );
    return () => clearTimeout(t);
  }, [visibleSteps]);

  const colorFor = (kind) => ({
    cmd:  'var(--accent)',
    info: 'var(--text-2)',
    try:  'var(--text)',
    warn: 'var(--warning)',
    ok:   'var(--success)',
    done: 'var(--success)',
  })[kind] || 'var(--text)';

  return (
    <section style={{
      position: 'relative', zIndex: 1,
      maxWidth: 1120, margin: '0 auto', padding: '80px 24px',
    }}>
      <SectionLabel>How routing works</SectionLabel>
      <SectionHeading>When one provider stalls, the next picks up.</SectionHeading>
      <SectionBlurb>
        Every task is scored by input length and modality, then dispatched through
        a tuned chain. Rate limits, model errors, or 5xx responses trigger an
        instant fallthrough — no retries, no manual swap.
      </SectionBlurb>

      <div style={{
        background: '#0a0908',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset',
      }}>
        {/* Terminal chrome */}
        <div style={{
          padding: '11px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a3633' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a3633' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a3633' }} />
          <span style={{
            marginLeft: 12, fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-3)', letterSpacing: '0.04em',
          }}>
            cortex · routing
          </span>
        </div>

        {/* Log body */}
        <div style={{
          padding: '22px 24px',
          fontFamily: 'var(--font-mono)', fontSize: 13.5, lineHeight: 1.75,
          minHeight: 240,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {ROUTING_STEPS.slice(0, visibleSteps).map((step, i) => (
            <div key={`${visibleSteps}-${i}`} className="cx-in"
                 style={{ color: colorFor(step.kind), whiteSpace: 'pre' }}>
              {step.text}
            </div>
          ))}
          {visibleSteps < ROUTING_STEPS.length && (
            <span className="cx-blink" style={{
              color: 'var(--accent)', fontFamily: 'var(--font-mono)',
              fontSize: 14,
            }}>▌</span>
          )}
        </div>
      </div>

      {/* Provider pills below the terminal */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        marginTop: 16, paddingLeft: 4,
      }}>
        {[
          { id: 'groq',       label: 'Groq',       model: 'Llama 3.3 70B', color: 'var(--teal)'  },
          { id: 'cerebras',   label: 'Cerebras',   model: 'GPT-OSS 120B',  color: 'var(--amber)' },
          { id: 'gemini',     label: 'Gemini',     model: '2.5 Flash',     color: 'var(--info)'  },
          { id: 'openrouter', label: 'OpenRouter', model: 'Llama 3.3 70B', color: 'var(--text-2)' },
        ].map((p, i) => (
          <span key={p.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 11px',
            fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{p.label}</span>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <span style={{ color: 'var(--text-2)' }}>{p.model}</span>
            {i < 3 && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"
                   style={{ marginLeft: 4 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────── Operations ───────────────────── */

function Operations() {
  return (
    <section style={{
      position: 'relative', zIndex: 1,
      maxWidth: 1120, margin: '0 auto', padding: '80px 24px',
    }}>
      <SectionLabel>Ten preset operations</SectionLabel>
      <SectionHeading>Tuned prompts. Custom prompts when you need them.</SectionHeading>
      <SectionBlurb>
        Each preset ships with a system prompt validated by an eval suite that
        runs in CI on every commit. Custom prompts route through the same
        provider fallback chain.
      </SectionBlurb>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 10,
      }}>
        {OPERATIONS.map((op) => (
          <div key={op.n} className="cx-card" style={{
            padding: '18px 20px',
            display: 'flex', flexDirection: 'column', gap: 6,
            transition: 'border-color 0.15s, background 0.15s',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-bright)';
              e.currentTarget.style.background = 'var(--surface-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--text-3)', fontWeight: 500,
              }}>
                {op.n}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 17,
                fontWeight: 600, color: 'var(--text)',
                letterSpacing: '-0.01em',
              }}>
                {op.name}
              </span>
            </div>
            <p style={{
              fontSize: 13, color: 'var(--text-2)',
              margin: '2px 0 0 24px', lineHeight: 1.55,
            }}>
              {op.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────── Topologies ───────────────────── */

function Topologies() {
  return (
    <section style={{
      position: 'relative', zIndex: 1,
      maxWidth: 1120, margin: '0 auto', padding: '80px 24px',
    }}>
      <SectionLabel>Two ways to deploy</SectionLabel>
      <SectionHeading>One codebase. A simple deployment and a production-grade one.</SectionHeading>
      <SectionBlurb max={680}>
        The <Code>main</Code> branch runs as a single Node process — exactly what
        you're using right now. The <Code>kubernetes</Code> branch preserves the
        original distributed architecture for when scale matters.
      </SectionBlurb>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 14,
      }}>
        <TopologyCard
          label="LIVE DEMO"
          accent="var(--accent)"
          title="Single-process"
          rows={[
            ['Runtime',  'Node.js 20, one container'],
            ['Tasks',    'in-process async (no queue)'],
            ['Storage',  'MongoDB Atlas · Cloudinary'],
            ['Hosting',  'Render + Vercel free tier'],
            ['Cold path','~3s wake on first request'],
          ]}
        />
        <TopologyCard
          label="KUBERNETES BRANCH"
          accent="var(--teal)"
          title="Distributed"
          rows={[
            ['Runtime',       'Node API + Python worker'],
            ['Tasks',         'Redis queue · BRPOP consumer'],
            ['Deploy',        'Kubernetes + Argo CD (GitOps)'],
            ['CI/CD',         'GitHub Actions → Docker Hub'],
            ['Observability', 'Prometheus + Grafana (planned)'],
          ]}
        />
      </div>
    </section>
  );
}

function TopologyCard({ label, title, accent, rows }) {
  return (
    <div className="cx-card" style={{ padding: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <span style={{ width: 18, height: 1, background: accent }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          color: accent, letterSpacing: '0.14em',
        }}>
          {label}
        </span>
      </div>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontWeight: 600,
        fontSize: 24, color: 'var(--text)',
        margin: '0 0 20px', letterSpacing: '-0.02em',
      }}>
        {title}
      </h3>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.map(([k, v], i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'baseline',
            padding: '11px 0',
            borderTop: i === 0 ? '1px solid var(--border)' : 'none',
            borderBottom: '1px solid var(--border)',
          }}>
            <dt style={{
              fontSize: 11, color: 'var(--text-2)', width: 124, flexShrink: 0,
              textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
            }}>
              {k}
            </dt>
            <dd style={{
              fontSize: 13.5, color: 'var(--text)', margin: 0,
              fontFamily: 'var(--font-mono)', lineHeight: 1.45,
            }}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Code({ children }) {
  return (
    <code style={{
      fontFamily: 'var(--font-mono)', fontSize: '0.92em',
      color: 'var(--accent)',
      background: 'var(--accent-soft)',
      padding: '1px 6px', borderRadius: 4,
    }}>
      {children}
    </code>
  );
}

/* ───────────────────── Tech strip ───────────────────── */

function TechStrip() {
  return (
    <section style={{
      position: 'relative', zIndex: 1,
      maxWidth: 1120, margin: '0 auto', padding: '40px 24px 64px',
    }}>
      <div style={{
        borderTop: '1px solid var(--divider)',
        borderBottom: '1px solid var(--divider)',
        padding: '24px 0',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <StripRow label="STACK">
          React 19 · Vite 8 · Tailwind 4 · Node 20 · Express 5 · MongoDB · Cloudinary
        </StripRow>
        <StripRow label="PROVIDERS">
          Groq · Cerebras · Google Gemini · OpenRouter
        </StripRow>
        <StripRow label="INFRA">
          Render · Vercel · MongoDB Atlas · Docker · Kubernetes · Argo CD · GitHub Actions
        </StripRow>
      </div>
    </section>
  );
}

function StripRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        color: 'var(--text-3)', letterSpacing: '0.14em',
        minWidth: 86, flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
        {children}
      </span>
    </div>
  );
}

/* ───────────────────── Footer ───────────────────── */

function Footer() {
  return (
    <footer style={{
      position: 'relative', zIndex: 1,
      maxWidth: 1120, margin: '0 auto', padding: '36px 24px 64px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 14,
    }}>
      <Logo size={22} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        fontSize: 12, color: 'var(--text-2)', flexWrap: 'wrap',
      }}>
        <span>Built by Ishaan Goswami</span>
        <span style={{ color: 'var(--text-3)' }}>·</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={{
          color: 'var(--text-2)', textDecoration: 'none',
          borderBottom: '1px solid var(--border-bright)', paddingBottom: 1,
        }}>
          GitHub
        </a>
        <span style={{ color: 'var(--text-3)' }}>·</span>
        <span>2026</span>
      </div>
    </footer>
  );
}