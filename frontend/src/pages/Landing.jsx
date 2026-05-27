import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Landing.css";
/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */

function Nav() {
  const { user } = useAuth();
  return (
    <nav className="cx-nav">
      <div className="cx-nav-inner">
        <Link to="/" className="cx-brand">
          <span className="cx-brand-mark">◆</span>
          <span className="cx-brand-text">cortex</span>
        </Link>
        <div className="cx-nav-links">
          <a
            href="https://github.com/Ishaan2510/cortex"
            target="_blank"
            rel="noopener noreferrer"
            className="cx-nav-link"
          >
            GitHub
          </a>
          <a href="#how-routing-works" className="cx-nav-link">
            How it works
          </a>
          <a href="#deployment" className="cx-nav-link">
            Deployment
          </a>
          {user ? (
            <Link to="/dashboard" className="cx-nav-cta">
              Dashboard
            </Link>
          ) : (
            <Link to="/login" className="cx-nav-cta">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  const { user } = useAuth();
  return (
    <section className="cx-hero">
      <div className="cx-hero-grid">
        <div className="cx-hero-left">
          <p className="cx-eyebrow">
            <span className="cx-eyebrow-dot" />
            Multi-provider LLM orchestration
          </p>
          <h1 className="cx-headline">
            One router.
            <br />
            <span className="cx-headline-italic">Four providers.</span>
            <br />
            No single point of failure.
          </h1>
          <p className="cx-lede">
            Cortex picks the right LLM for each request based on operation, input
            size, and modality — then streams tokens to the browser as they
            arrive and switches providers mid-stream if one drops out. Four
            providers in the chain, gated by a versioned eval suite in CI.
          </p>
          <div className="cx-hero-ctas">
            {user ? (
              <Link to="/dashboard" className="cx-cta-primary">
                Open dashboard
              </Link>
            ) : (
              <Link to="/register" className="cx-cta-primary">
                Try it free
              </Link>
            )}
          </div>
          <div className="cx-hero-strip">
            <span>Live token streaming</span>
            <span className="cx-hero-strip-dot">·</span>
            <span>Mid-stream provider fallback</span>
            <span className="cx-hero-strip-dot">·</span>
            <span>10 operations + custom prompt</span>
          </div>
        </div>

        <aside className="cx-hero-right">
          <div className="cx-spec-card">
            <div className="cx-spec-row">
              <span className="cx-spec-key">PROVIDERS</span>
              <span className="cx-spec-val">04 / chained</span>
            </div>
            <div className="cx-spec-row">
              <span className="cx-spec-key">OPERATIONS</span>
              <span className="cx-spec-val">10 + custom</span>
            </div>
            <div className="cx-spec-row">
              <span className="cx-spec-key">TRANSPORT</span>
              <span className="cx-spec-val">SSE / streaming</span>
            </div>
            <div className="cx-spec-row">
              <span className="cx-spec-key">FALLBACK</span>
              <span className="cx-spec-val">auto, mid-stream</span>
            </div>
            <div className="cx-spec-row">
              <span className="cx-spec-key">DEPLOY</span>
              <span className="cx-spec-val">vercel · render · k8s</span>
            </div>
            <div className="cx-spec-row">
              <span className="cx-spec-key">EVAL</span>
              <span className="cx-spec-val">CI-gated, 50 cases</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  RoutingDemo — terminal-style animation of router fallthrough       */
/* ------------------------------------------------------------------ */

const ROUTING_FRAMES = [
  { t: 0,    line: "input.length = 8,200    has_image = false    op = summarize" },
  { t: 600,  line: "→ chain = [groq, cerebras, gemini, openrouter]" },
  { t: 1200, line: "try groq…              429 rate_limited" },
  { t: 1900, line: "try cerebras…          ok  · 380ms · 142 tok" },
  { t: 2400, line: "providerUsed: cerebras", emphasize: true },
];

function RoutingDemo() {
  const [visibleUntil, setVisibleUntil] = useState(-1);
  const timersRef = useRef([]);

  useEffect(() => {
    const timers = timersRef.current;

    const clear = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };

    const run = () => {
      clear();
      setVisibleUntil(-1);

      // Schedule each frame to appear
      ROUTING_FRAMES.forEach((frame, i) => {
        timers.push(setTimeout(() => setVisibleUntil(i), frame.t + 200));
      });

      // After all frames have shown + a hold beat, restart from the top
      const lastFrameAt = ROUTING_FRAMES[ROUTING_FRAMES.length - 1].t + 200;
      const restartAt = lastFrameAt + 2500;
      timers.push(setTimeout(run, restartAt));
    };

    run();
    return clear;
  }, []);

  return (
    <section id="how-routing-works" className="cx-section">
      <div className="cx-section-head">
        <span className="cx-section-num">01</span>
        <h2 className="cx-section-title">How routing works</h2>
        <p className="cx-section-sub">
          Every request picks a provider chain from three signals — operation,
          input length, image presence. The chain runs top-down with automatic
          fallthrough on rate limits or errors.
        </p>
      </div>

      <div className="cx-terminal">
        <div className="cx-terminal-bar">
          <span className="cx-terminal-dot" />
          <span className="cx-terminal-dot" />
          <span className="cx-terminal-dot" />
          <span className="cx-terminal-title">router.js</span>
        </div>
        <div className="cx-terminal-body">
          {ROUTING_FRAMES.map((frame, i) => (
            <div
              key={i}
              className={`cx-term-line${
                i <= visibleUntil ? " cx-term-line-on" : ""
              }${frame.emphasize ? " cx-term-line-emph" : ""}`}
            >
              <span className="cx-term-prompt">$</span> {frame.line}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  StreamingDemo — character-by-character + mid-stream switch         */
/* ------------------------------------------------------------------ */

// Two passes of an answer streaming in. First pass aborts mid-way (provider
// failure), second pass starts fresh from a new provider.
const STREAM_PASS_1 = "Server-Sent Events keep a single HTTP connection ope";
const STREAM_PASS_2 =
  "Server-Sent Events keep a single HTTP connection open from the server to the browser. The backend writes `event: token` frames as tokens arrive from the LLM, and the browser's EventSource fires onmessage for each one.";

function StreamingDemo() {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState("groq");
  const [phase, setPhase] = useState("streaming"); // streaming | switched | done
  const [showSwitch, setShowSwitch] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    const timers = timersRef.current;

    const clear = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };

    const run = () => {
      clear();
      setText("");
      setProvider("groq");
      setPhase("streaming");
      setShowSwitch(false);

      // Pass 1: stream chars at ~25ms each
      for (let i = 0; i < STREAM_PASS_1.length; i++) {
        timers.push(
          setTimeout(() => setText(STREAM_PASS_1.slice(0, i + 1)), 250 + i * 28)
        );
      }

      // After pass 1 finishes — provider drops, switch banner appears
      const dropAt = 250 + STREAM_PASS_1.length * 28 + 400;
      timers.push(
        setTimeout(() => {
          setShowSwitch(true);
          setPhase("switched");
          setText("");
        }, dropAt)
      );

      // Switch to cerebras
      timers.push(
        setTimeout(() => {
          setProvider("cerebras");
        }, dropAt + 100)
      );

      // Pass 2 begins after the banner sits for a beat
      const pass2Start = dropAt + 900;
      for (let i = 0; i < STREAM_PASS_2.length; i++) {
        timers.push(
          setTimeout(
            () => setText(STREAM_PASS_2.slice(0, i + 1)),
            pass2Start + i * 14
          )
        );
      }

      // Mark done and queue a loop restart
      const doneAt = pass2Start + STREAM_PASS_2.length * 14 + 1800;
      timers.push(
        setTimeout(() => {
          setPhase("done");
        }, pass2Start + STREAM_PASS_2.length * 14)
      );
      timers.push(setTimeout(run, doneAt));
    };

    run();
    return clear;
  }, []);

  return (
    <section id="streaming" className="cx-section">
      <div className="cx-section-head">
        <span className="cx-section-num">02</span>
        <h2 className="cx-section-title">How streaming works</h2>
        <p className="cx-section-sub">
          Tokens arrive in the browser the moment the upstream LLM emits them.
          If a provider drops mid-stream, the partial output is cleared and the
          next provider in the chain picks up — no spliced text, no silent
          failure.
        </p>
      </div>

      <div className="cx-stream-shell">
        <div className="cx-stream-bar">
          <div className="cx-stream-bar-left">
            <span
              className={`cx-stream-status cx-stream-status-${
                phase === "done" ? "done" : "live"
              }`}
            />
            <span className="cx-stream-bar-label">
              {phase === "done" ? "COMPLETE" : "STREAMING · LIVE"}
            </span>
          </div>
          <div className="cx-stream-bar-right">
            <span className="cx-stream-meta">provider</span>
            <span className="cx-stream-provider">{provider}</span>
          </div>
        </div>

        <div className="cx-stream-body">
          {showSwitch && (
            <div className="cx-stream-switch">
              <span className="cx-stream-switch-mark">↻</span>
              provider switched mid-stream · cleared buffer · resuming with{" "}
              <strong>cerebras</strong>
            </div>
          )}

          <div className="cx-stream-text">
            {text}
            {phase !== "done" && <span className="cx-stream-cursor" />}
          </div>

          {phase === "done" && (
            <div className="cx-stream-footer">
              <span className="cx-stream-footer-key">event</span>
              <span className="cx-stream-footer-val">complete</span>
              <span className="cx-stream-footer-key">tokens</span>
              <span className="cx-stream-footer-val">~62</span>
              <span className="cx-stream-footer-key">latency to first token</span>
              <span className="cx-stream-footer-val">240ms</span>
            </div>
          )}
        </div>
      </div>

      <div className="cx-stream-callouts">
        <div className="cx-stream-callout">
          <span className="cx-stream-callout-num">01</span>
          <h4 className="cx-stream-callout-title">httpOnly cookie auth</h4>
          <p className="cx-stream-callout-body">
            EventSource can't send Authorization headers, so the SSE endpoint
            verifies a Secure, SameSite=None session cookie set at login.
          </p>
        </div>
        <div className="cx-stream-callout">
          <span className="cx-stream-callout-num">02</span>
          <h4 className="cx-stream-callout-title">33ms render batching</h4>
          <p className="cx-stream-callout-body">
            Groq emits ~70 chunks/sec. Tokens accumulate in a ref and flush to
            state on a 33ms timer — perceptually continuous, never stutters.
          </p>
        </div>
        <div className="cx-stream-callout">
          <span className="cx-stream-callout-num">03</span>
          <h4 className="cx-stream-callout-title">15s keep-alive</h4>
          <p className="cx-stream-callout-body">
            Render's free-tier proxy kills idle connections at 30s. The endpoint
            writes an SSE comment every 15s — silent on the client, alive on
            the wire.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Operations                                                         */
/* ------------------------------------------------------------------ */

const OPERATIONS = [
  { n: "01", name: "Summarize", note: "3–5 bullets" },
  { n: "02", name: "Action items", note: "with owners" },
  { n: "03", name: "Rewrite formal", note: "professional tone" },
  { n: "04", name: "Rewrite casual", note: "warm + clear" },
  { n: "05", name: "LinkedIn post", note: "hook · body · CTA" },
  { n: "06", name: "Draft email", note: "subject + sign-off" },
  { n: "07", name: "Key decisions", note: "+ open questions" },
  { n: "08", name: "Explain simply", note: "16yo reading level" },
  { n: "09", name: "Tweet thread", note: "5–8 tweets" },
  { n: "10", name: "Translate · Hindi", note: "Devanagari" },
];

function Operations() {
  return (
    <section className="cx-section">
      <div className="cx-section-head">
        <span className="cx-section-num">03</span>
        <h2 className="cx-section-title">Ten operations · one router</h2>
        <p className="cx-section-sub">
          Each preset is a hand-tuned system prompt. Text, PDF (PyMuPDF
          extracted), or image (Gemini multimodal) — up to 10MB.
        </p>
      </div>

      <div className="cx-ops-grid">
        {OPERATIONS.map((op) => (
          <div key={op.n} className="cx-op-card">
            <span className="cx-op-num">{op.n}</span>
            <span className="cx-op-name">{op.name}</span>
            <span className="cx-op-note">{op.note}</span>
          </div>
        ))}
      </div>

      <div className="cx-ops-custom">
        <span className="cx-ops-custom-plus">+</span>
        <span className="cx-ops-custom-text">
          <strong>Custom prompt mode</strong> — provide your own system prompt,
          routed through the same fallback chain.
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  EvalSection — CI-gated regression suite                            */
/* ------------------------------------------------------------------ */

function EvalSection() {
  return (
    <section className="cx-section">
      <div className="cx-section-head">
        <span className="cx-section-num">04</span>
        <h2 className="cx-section-title">Eval-gated in CI</h2>
        <p className="cx-section-sub">
          Every PR that touches prompts or the router runs a deterministic eval
          suite. Pass rates that drop more than 5 percentage points below
          baseline fail the build. Accepting a regression requires a deliberate
          commit.
        </p>
      </div>

      <div className="cx-eval-grid">
        <div className="cx-eval-card">
          <div className="cx-eval-card-head">
            <span className="cx-eval-card-tag">CASE · YAML</span>
            <span className="cx-eval-card-meta">draft_email · 5 of 5</span>
          </div>
          <pre className="cx-eval-yaml">{`- id: business_followup
  input: |
    Following up on the
    Q3 budget meeting...
  operation: draft_email
  checks:
    - type: regex_match
      pattern: "^Subject:"
    - type: must_contain
      values: ["follow", "Q3"]
    - type: min_length
      value: 200`}</pre>
        </div>

        <div className="cx-eval-card">
          <div className="cx-eval-card-head">
            <span className="cx-eval-card-tag">CI · SMOKE</span>
            <span className="cx-eval-card-meta cx-eval-pass">green</span>
          </div>
          <div className="cx-eval-ci">
            <div className="cx-eval-ci-row">
              <span className="cx-eval-ci-op">summarize</span>
              <span className="cx-eval-ci-bar">
                <span className="cx-eval-ci-fill" style={{ width: "100%" }} />
              </span>
              <span className="cx-eval-ci-rate">5/5</span>
            </div>
            <div className="cx-eval-ci-row">
              <span className="cx-eval-ci-op">action_items</span>
              <span className="cx-eval-ci-bar">
                <span className="cx-eval-ci-fill" style={{ width: "100%" }} />
              </span>
              <span className="cx-eval-ci-rate">5/5</span>
            </div>
            <div className="cx-eval-ci-row">
              <span className="cx-eval-ci-op">draft_email</span>
              <span className="cx-eval-ci-bar">
                <span className="cx-eval-ci-fill" style={{ width: "100%" }} />
              </span>
              <span className="cx-eval-ci-rate">5/5</span>
            </div>
            <div className="cx-eval-ci-row">
              <span className="cx-eval-ci-op">explain_simply</span>
              <span className="cx-eval-ci-bar">
                <span className="cx-eval-ci-fill" style={{ width: "80%" }} />
              </span>
              <span className="cx-eval-ci-rate">4/5</span>
            </div>
            <div className="cx-eval-ci-row">
              <span className="cx-eval-ci-op">tweet_thread</span>
              <span className="cx-eval-ci-bar">
                <span className="cx-eval-ci-fill" style={{ width: "100%" }} />
              </span>
              <span className="cx-eval-ci-rate">5/5</span>
            </div>
            <div className="cx-eval-ci-footer">
              10 ops · sticky PR comment on every push
            </div>
          </div>
        </div>

        <div className="cx-eval-card">
          <div className="cx-eval-card-head">
            <span className="cx-eval-card-tag">REGRESSION GATE</span>
            <span className="cx-eval-card-meta">5pp threshold</span>
          </div>
          <div className="cx-eval-gate">
            <div className="cx-eval-gate-row">
              <span className="cx-eval-gate-key">baseline</span>
              <span className="cx-eval-gate-val">98.0%</span>
            </div>
            <div className="cx-eval-gate-row">
              <span className="cx-eval-gate-key">this PR</span>
              <span className="cx-eval-gate-val">96.0%</span>
            </div>
            <div className="cx-eval-gate-row">
              <span className="cx-eval-gate-key">delta</span>
              <span className="cx-eval-gate-val cx-eval-gate-ok">
                −2.0pp · within tolerance
              </span>
            </div>
            <div className="cx-eval-gate-divider" />
            <p className="cx-eval-gate-note">
              Five scorer types: <code>must_contain</code>,{" "}
              <code>must_not_contain</code>, <code>format_bullets</code>,{" "}
              <code>min/max_length</code>, <code>regex_match</code>. No LLM
              judges — every check is a pure function of the output string.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Topologies                                                         */
/* ------------------------------------------------------------------ */

function Topologies() {
  return (
    <section id="deployment" className="cx-section">
      <div className="cx-section-head">
        <span className="cx-section-num">05</span>
        <h2 className="cx-section-title">Two deployment topologies</h2>
        <p className="cx-section-sub">
          The live demo runs a Node-only topology on free hosting. The full
          production architecture — Python worker, Redis queue + pub/sub,
          Kubernetes, Argo CD — lives intact on the kubernetes branch.
        </p>
      </div>

      <div className="cx-topo-grid">
        <div className="cx-topo-card">
          <div className="cx-topo-card-head">
            <span className="cx-topo-tag cx-topo-tag-live">LIVE DEMO</span>
            <span className="cx-topo-branch">main</span>
          </div>
          <h3 className="cx-topo-title">Node-only · streaming in-process</h3>
          <pre className="cx-topo-ascii">{`React (Vercel)
   │  HTTPS + SSE
   ▼
Node + Express (Render)
   ├─▶ MongoDB Atlas
   ├─▶ Cloudinary (files)
   └─▶ LLM routing + streaming
        Groq · Cerebras
        Gemini · OpenRouter`}</pre>
          <ul className="cx-topo-points">
            <li>One process · in-memory event bus per task</li>
            <li>Zero cost · zero credit cards required</li>
            <li>Render + Vercel + Atlas free tiers</li>
          </ul>
        </div>

        <div className="cx-topo-card">
          <div className="cx-topo-card-head">
            <span className="cx-topo-tag cx-topo-tag-prod">
              KUBERNETES BRANCH
            </span>
            <span className="cx-topo-branch">kubernetes</span>
          </div>
          <h3 className="cx-topo-title">Worker · queue · pub/sub · GitOps</h3>
          <pre className="cx-topo-ascii">{`React (Nginx)
   │
Node + Express ──┬─▶ MongoDB (StatefulSet)
                 └─▶ Redis (queue + pub/sub)
                       │
                       ▼
                  Python Worker × N
                       │
                       └─▶ LLM routing + PyMuPDF`}</pre>
          <ul className="cx-topo-points">
            <li>brpop guarantees exactly-once task delivery</li>
            <li>Redis pub/sub fans tokens to backend SSE</li>
            <li>Argo CD · auto-sync · prune · self-heal</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  TechStrip                                                          */
/* ------------------------------------------------------------------ */

function TechStrip() {
  return (
    <section className="cx-tech">
      <div className="cx-tech-row">
        <span className="cx-tech-label">STACK</span>
        <span className="cx-tech-items">
          React 19 · Vite · Tailwind v4 · Node · Express 5 · MongoDB · SSE ·
          EventSource · Cloudinary
        </span>
      </div>
      <div className="cx-tech-row">
        <span className="cx-tech-label">PROVIDERS</span>
        <span className="cx-tech-items">
          Groq · Cerebras · Google Gemini · OpenRouter
        </span>
      </div>
      <div className="cx-tech-row">
        <span className="cx-tech-label">INFRA</span>
        <span className="cx-tech-items">
          Docker · Kubernetes · Redis · Python worker · Argo CD · GitHub
          Actions · prompt eval framework · Render · Vercel · MongoDB Atlas
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="cx-footer">
      <div className="cx-footer-inner">
        <div>
          <span className="cx-footer-brand">cortex</span>
          <span className="cx-footer-dot">·</span>
          <span className="cx-footer-meta">MIT</span>
        </div>
        <div className="cx-footer-links">
          <a
            href="https://github.com/Ishaan2510/cortex"
            target="_blank"
            rel="noopener noreferrer"
          >
            App repo
          </a>
          <a
            href="https://github.com/Ishaan2510/cortex-infra"
            target="_blank"
            rel="noopener noreferrer"
          >
            Infra repo
          </a>
          <a
            href="https://github.com/Ishaan2510"
            target="_blank"
            rel="noopener noreferrer"
          >
            Built by Ishaan Goswami
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Landing() {
  return (
    <div className="cx-page">
      <Nav />
      <Hero />
      <RoutingDemo />
      <StreamingDemo />
      <Operations />
      <EvalSection />
      <Topologies />
      <TechStrip />
      <Footer />
    </div>
  );
}