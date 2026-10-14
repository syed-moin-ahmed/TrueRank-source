// Animated ILLUSTRATION of the pipeline for the landing page (example values, clearly labelled).
import { useEffect, useState } from "react";
import { LuSearch, LuShieldCheck, LuSparkles } from "react-icons/lu";

const QUERY = "Need an electrician to repair damaged wiring and a circuit breaker";
const TERMS = ["electrician", "repair", "damage", "wire", "circuit", "breaker"];
const LAMBDA = 0.7;
// Illustrative numbers only: chosen to show how trust can reorder close skill matches.
const WORKERS = [
  { id: "A", s: 0.72, ts: 0.58 },
  { id: "B", s: 0.64, ts: 0.93 },
  { id: "C", s: 0.41, ts: 0.88 },
].map((w) => ({ ...w, r: LAMBDA * w.s + (1 - LAMBDA) * w.ts }));

const STAGES = 7;

export default function HeroDemo() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (typed < QUERY.length) {
      const t = setTimeout(() => setTyped((n) => n + 1), 28);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setStep((s) => {
        if (s >= STAGES + 3) {
          setTyped(0);
          return 0;
        }
        return s + 1;
      });
    }, step >= STAGES ? 1600 : 650);
    return () => clearTimeout(t);
  }, [typed, step]);

  const showTerms = step >= 2;
  const showSim = step >= 4;
  const showTrust = step >= 5;
  const fused = step >= 6;
  const order = fused ? [...WORKERS].sort((a, b) => b.r - a.r) : [...WORKERS].sort((a, b) => b.s - a.s);

  return (
    <div className="demo-card anim-scale-in" data-tilt data-tilt-max="7" aria-label="Animated illustration of the TrueRank pipeline">
      <div className="floating-badge fb-1">
        <span className="icon-bubble teal"><LuSparkles /></span>
        TF-IDF + cosine
      </div>
      <div className="floating-badge fb-2">
        <span className="icon-bubble amber"><LuShieldCheck /></span>
        Trust-aware ranking
      </div>

      <div className="demo-caption">
        <span>How a request is ranked</span>
        <span>Illustrative example</span>
      </div>
      <div className="demo-query">
        <LuSearch style={{ width: 18, height: 18, flexShrink: 0, color: "#ff9cc2" }} />
        <span className={typed < QUERY.length ? "typing" : ""}>{QUERY.slice(0, typed)}</span>
      </div>

      <div className="demo-steps" aria-hidden="true">
        {Array.from({ length: STAGES }, (_, i) => (
          <div key={i} className={`demo-step ${step > i ? "done" : ""}`}>
            <span />
          </div>
        ))}
      </div>

      <div className="demo-terms">
        {showTerms &&
          TERMS.map((t, i) => (
            <span key={t} className="chip teal" style={{ animationDelay: `${i * 60}ms` }}>
              {t}
            </span>
          ))}
        {!showTerms && <span className="tiny muted">Preprocessing…</span>}
      </div>

      <div className="demo-rank" style={{ height: 3 * 74 }}>
        {WORKERS.map((w) => {
          const pos = order.findIndex((o) => o.id === w.id);
          return (
            <div
              key={w.id}
              className="demo-worker"
              style={{ position: "absolute", left: 0, right: 0, transform: `translateY(${pos * 74}px)`, boxShadow: fused && pos === 0 ? "0 0 0 2px #ffad1f, var(--shadow)" : undefined }}
            >
              <span className="avatar sm" style={{ background: pos === 0 && fused ? "linear-gradient(135deg,#ffd047,#ff9d1f)" : undefined }}>
                {w.id}
              </span>
              <div className="bars">
                <div className="row-between tiny strong">
                  <span>Worker {w.id}</span>
                  <span className="muted mono">S {showSim ? w.s.toFixed(2) : "–"} · TS {showTrust ? w.ts.toFixed(2) : "–"}</span>
                </div>
                <div className="bar sim thin"><span style={{ width: showSim ? `${w.s * 100}%` : 0 }} /></div>
                <div className="bar trust thin"><span style={{ width: showTrust ? `${w.ts * 100}%` : 0 }} /></div>
              </div>
              <span className="score" style={{ color: fused ? "var(--violet)" : "var(--ink-300)" }}>{fused ? w.r.toFixed(2) : "…"}</span>
            </div>
          );
        })}
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>
        {fused ? "R = 0.7·S + 0.3·TS — worker B moves up because of a higher trust score." : "Workers are first compared on skill similarity…"}
      </p>
    </div>
  );
}
