import { useState } from "react";
import { LuArrowDown, LuFlaskConical, LuPlay, LuRefreshCw, LuSettings2, LuShieldCheck, LuWandSparkles } from "react-icons/lu";
import { RankFormula, TrustFormula } from "../../components/truerank.jsx";
import { Alert, Button, Card, CardHeader, IconBubble, Textarea } from "../../components/ui.jsx";
import { useApi, useDocumentTitle, useReveal } from "../../hooks/index.js";
import { post } from "../../services/api.js";
import { PipelineExplorer } from "./Landing.jsx";
import Cubes3D from "../../components/Cubes3D.jsx";

const SAMPLES = [
  "I need an electrician to repair damaged wiring and a circuit breaker.",
  "Our bathroom pipes are leaking and the sink is blocked!!",
  "Looking for someone to install 4 CCTV cameras with mobile view.",
];

function PreprocessDemo() {
  const [text, setText] = useState(SAMPLES[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async (value = text) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await post("/meta/preprocess", { text: value }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="reveal">
      <CardHeader title="Try the preprocessing stage" icon={LuWandSparkles} subtitle="Runs the real backend preprocessing function (the same one used for matching)." />
      <div className="stack">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} style={{ minHeight: 80 }} />
        <div className="row">
          {SAMPLES.map((s) => (
            <button key={s} type="button" className="chip clickable gray" onClick={() => { setText(s); run(s); }}>{s.slice(0, 34)}…</button>
          ))}
          <Button variant="primary" icon={LuPlay} loading={loading} onClick={() => run()} style={{ marginLeft: "auto" }}>Run</Button>
        </div>
        {error && <Alert type="error">{error}</Alert>}
        {result && (
          <div className="stack stagger" style={{ "--gap": "12px" }}>
            {[
              ["1 · Lowercase + remove punctuation/noise", <code key="c">{result.cleaned || "—"}</code>],
              ["2 · Tokens", <div className="tag-row" key="t">{result.tokens.map((t, i) => <span className="chip gray" key={i}>{t}</span>)}</div>],
              ["3 · Removed stop words", <div className="tag-row" key="s">{result.removed_stop_words.length ? result.removed_stop_words.map((t, i) => <span className="chip red strike" key={i}>{t}</span>) : <span className="muted small">none</span>}</div>],
              ["4 · Lemmatized terms sent to TF-IDF", <div className="tag-row" key="l">{result.terms.map((t, i) => <span className="chip teal" key={i}>{t}</span>)}</div>],
            ].map(([label, body], i) => (
              <div key={label} style={{ "--i": i }}>
                <div className="small strong muted" style={{ marginBottom: 6 }}>{label}</div>
                {body}
                {i < 3 && <LuArrowDown style={{ width: 16, height: 16, color: "var(--ink-300)", margin: "10px 0 0 4px" }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function HowItWorks() {
  useDocumentTitle("How it works");
  const config = useApi("/meta/config");
  useReveal([config.data]);
  const c = config.data;

  return (
    <>
      <section className="section page-hero" style={{ paddingBottom: 40 }}>
        <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
        <Cubes3D preset="banner" />
        <div className="container section-head anim-fade-up" style={{ position: "relative" }}>
          <span className="eyebrow"><LuFlaskConical /> Methodology</span>
          <h1 style={{ fontSize: "clamp(2rem, 3vw + 1rem, 3rem)" }}>How <span className="grad-text">TrueRank</span> works</h1>
          <p className="lead">Profile preprocessing → feature extraction &amp; similarity matching → trust scoring → worker ranking. The four phases of the paper, implemented as a live web system.</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <PipelineExplorer />
        </div>
      </section>

      <section className="section-tight">
        <div className="container grid grid-2">
          <PreprocessDemo />
          <div className="stack">
            <Card className="reveal">
              <CardHeader title="The two equations" icon={LuShieldCheck} tone="amber" />
              <div className="stack">
                <TrustFormula weights={c?.trust_weights} />
                <RankFormula lambda={c?.lambda ?? 0.7} />
                <p className="small muted">
                  Every component is normalised to the range 0–1 so that the trust score and cosine similarity are on the same scale before fusion.
                </p>
              </div>
            </Card>
            <Card className="reveal reveal-delay-1">
              <CardHeader title="The feedback loop" icon={LuRefreshCw} tone="teal" />
              <div className="tag-row" style={{ alignItems: "center" }}>
                {["Worker selected", "Job in progress", "Job completed", "Rating & feedback", "Optional dispute", "Database updated", "Trust recalculated", "Future ranking changes"].map((s, i, arr) => (
                  <span key={s} className="row" style={{ "--gap": "6px" }}>
                    <span className={`chip ${i >= 5 ? "amber" : "sky"}`}>{s}</span>
                    {i < arr.length - 1 && <span className="muted">→</span>}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ paddingBottom: 96 }}>
        <div className="container">
          <Card className="reveal">
            <CardHeader title="Implementation choices made for the web application" icon={LuSettings2} subtitle="These are engineering decisions needed to run the method live. They are not claims from the research paper." />
            <div className="grid grid-2">
              {[
                ["Dispute Adjustment (DA)", "The dataset stores a dispute count. TrueRank uses DA = 1 − min(1, disputes ÷ completed jobs), the “inverted dispute counter” described in the paper, so the published +0.20 weight is kept unchanged."],
                ["Normalisation", `AR = rating ÷ 5, CR = completed ÷ accepted jobs, PE = min(endorsements, ${c?.pe_cap ?? 20}) ÷ ${c?.pe_cap ?? 20}. All components lie in 0–1.`],
                ["New workers (cold start)", `A component with no data yet is shown as “Not enough data” and a neutral value of ${(c?.neutral_prior ?? 0.5).toFixed(2)} is used in the score, so new workers are neither rewarded nor punished for missing history.`],
                ["Similarity threshold τ", `Workers with S(w,q) below ${(c?.min_similarity ?? 0.05).toFixed(2)} are not ranked. Without it, a highly trusted worker with no matching skill could appear for an unrelated request.`],
                ["Lexical matching", "TF-IDF compares words, not meaning: “electrical” and “electrician” are different terms. Transformer models are listed as future work in the paper."],
                ["Dataset workers", "Profiles imported from a dataset have no login, so jobs sent to them are auto-accepted and clearly marked."],
              ].map(([title, text]) => (
                <div className="row" key={title} style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <IconBubble icon={LuSettings2} tone="sky" />
                  <div>
                    <h4>{title}</h4>
                    <p className="small muted mt-8">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
