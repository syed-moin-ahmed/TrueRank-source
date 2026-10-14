import { useState } from "react";
import {
  LuArrowRight, LuBadgeCheck, LuBrain, LuChartColumn, LuCircleCheck, LuDatabase, LuFileX, LuHammer, LuSearch,
  LuShieldCheck, LuSparkles, LuUserCheck, LuUsers, LuWrench, LuEyeOff, LuGauge,
} from "react-icons/lu";
import { AnimatedNumber, Bar } from "../../components/charts.jsx";
import { RankFormula, TrustFormula } from "../../components/truerank.jsx";
import { Button, Card, IconBubble } from "../../components/ui.jsx";
import { useApi, useDocumentTitle, useReveal } from "../../hooks/index.js";
import HeroDemo from "./HeroDemo.jsx";
import Cubes3D from "../../components/Cubes3D.jsx";
import Network3D, { HUES } from "../../components/Network3D.jsx";
import { useTilt } from "../../hooks/index.js";
import { PIPELINE_STEPS } from "./pipelineSteps.js";
import OccupationIcon from "../../components/OccupationIcon.jsx";

export function PipelineExplorer() {
  const [active, setActive] = useState(0);
  const step = PIPELINE_STEPS[active];
  return (
    <div>
      <div className="pipeline">
        {PIPELINE_STEPS.map((s, i) => (
          <button key={s.key} type="button" className={`pipe-step ${active === i ? "active" : ""}`} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)}>
            <span className="num">0{i + 1}</span>
            <IconBubble icon={s.icon} tone={s.tone} />
            <h4>{s.title}</h4>
          </button>
        ))}
      </div>
      <div className="pipe-detail card" key={step.key}>
        <div className="stack" style={{ "--gap": "10px" }}>
          <span className="eyebrow" style={{ alignSelf: "flex-start" }}>Stage {active + 1} of 7</span>
          <h3 style={{ fontSize: "1.4rem" }}>{step.title}</h3>
          <p className="muted">{step.detail}</p>
        </div>
        <div className="formula" style={{ whiteSpace: "normal" }}>{step.code}</div>
      </div>
    </div>
  );
}

const PROBLEMS = [
  { icon: LuFileX, tone: "pink", title: "No formal resume", text: "Plumbers, electricians and carpenters often have years of practical skill but no CV, certificate or structured employment history." },
  { icon: LuEyeOff, tone: "amber", title: "Invisible to digital platforms", text: "Most recruitment systems match on structured resumes and qualifications, so informal workers are filtered out before anyone sees them." },
  { icon: LuShieldCheck, tone: "teal", title: "No way to judge reliability", text: "Customers cannot easily tell who is reliable. Ratings, completed jobs, peer endorsements and disputes are scattered or unused." },
];

export default function Landing() {
  useDocumentTitle("");
  const overview = useApi("/meta/overview");
  const config = useApi("/meta/config");
  useReveal([overview.data, config.data]);
  useTilt([overview.data]);
  const weights = config.data?.trust_weights;
  const lambda = config.data?.lambda ?? 0.7;
  const o = overview.data;
  const onlyDemo = o && o.worker_sources && Object.keys(o.worker_sources).every((k) => k !== "research_dataset");

  return (
    <>
      <section className="hero">
        <div className="blobs">
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="blob b3" />
          <div className="blob b4" />
        </div>
        <div className="grid-bg" />
        <Cubes3D preset="hero" />
        <div className="container hero-grid">
          <div className="anim-fade-up">
            <span className="eyebrow"><LuSparkles /> Trust-aware NLP framework</span>
            <h1>
              <span className="line">Skills over certificates.</span>
              <span className="line grad-text">Trust over paperwork.</span>
            </h1>
            <p className="lead">
              TrueRank matches informal workers to real service and industry demand using what they can actually do,
              written in their own words, plus a Composite Trust Score built from ratings, completed jobs, peer
              endorsements and disputes.
            </p>
            <div className="hero-cta">
              <Button variant="primary" size="lg" icon={LuSearch} to="/register?role=requester">Find a skilled worker</Button>
              <Button size="lg" icon={LuHammer} to="/register?role=worker">I am a skilled worker</Button>
            </div>
            <div className="hero-points">
              <span><LuCircleCheck /> No resume needed</span>
              <span><LuCircleCheck /> Explainable scores</span>
              <span><LuCircleCheck /> Feedback updates trust</span>
            </div>
          </div>
          <HeroDemo />
        </div>
      </section>

      {o && o.occupation_names?.length > 0 && (
        <section className="section-tight" style={{ paddingTop: 0 }}>
          <div className="marquee">
            <div className="marquee-track">
              {[...o.occupation_names, ...o.occupation_names].map((name, i) => (
                <span className="marquee-item" key={i}><OccupationIcon occupation={name} /> {name}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <Cubes3D preset="section" network={false} />
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow">The problem</span>
            <h2>Practical skill, but no paper trail</h2>
            <p className="lead">The informal sector includes millions of skilled workers who lack formal certification. Traditional hiring systems cannot see them.</p>
          </div>
          <div className="grid grid-3">
            {PROBLEMS.map((p, i) => (
              <Card key={p.title} hover data-tilt className={`problem-card card-glow reveal reveal-delay-${i + 1}`}>
                <IconBubble icon={p.icon} tone={p.tone} />
                <h3>{p.title}</h3>
                <p className="muted">{p.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "linear-gradient(180deg, transparent, #efeaff 40%, transparent)" }}>
        <Cubes3D preset="section" />
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><LuBrain /> The TrueRank pipeline</span>
            <h2>Seven stages from a sentence to a ranked shortlist</h2>
            <p className="lead">Hover or tap each stage. This is exactly the pipeline the backend runs for every search.</p>
          </div>
          <div className="reveal">
            <PipelineExplorer />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-2" style={{ alignItems: "stretch" }}>
          <Card className="formula-card reveal">
            <div className="row">
              <IconBubble icon={LuShieldCheck} tone="amber" />
              <div>
                <h3>Composite Trust Score</h3>
                <p className="small muted">Behavioural reliability, weights from the paper</p>
              </div>
            </div>
            <TrustFormula weights={weights} />
            {[
              ["AR", "Average Rating"],
              ["CR", "Completion Rate"],
              ["PE", "Peer Endorsements"],
              ["DA", "Dispute Adjustment"],
            ].map(([k, label]) => (
              <div className="weight-row" key={k}>
                <span>{label} <span className="muted mono">({k})</span></span>
                <Bar value={weights ? weights[k] / 0.4 : null} tone="trust" />
                <span className="mono">{weights ? weights[k].toFixed(2) : "—"}</span>
              </div>
            ))}
          </Card>
          <Card className="formula-card reveal reveal-delay-1">
            <div className="row">
              <IconBubble icon={LuGauge} />
              <div>
                <h3>TrueRank score</h3>
                <p className="small muted">Skill relevance fused with trust (λ = {lambda.toFixed(2)})</p>
              </div>
            </div>
            <RankFormula lambda={lambda} />
            <div className="stack" style={{ "--gap": "10px" }}>
              <div className="row-between small strong"><span className="text-sim">Skill similarity S(w,q)</span><span className="mono">{Math.round(lambda * 100)}%</span></div>
              <div className="composition" style={{ height: 22 }}>
                <span className="c-sim" style={{ width: `${lambda * 100}%` }} />
                <span className="c-trust" style={{ width: `${(1 - lambda) * 100}%` }} />
              </div>
              <div className="row-between small strong"><span className="text-trust">Trust score TS(w)</span><span className="mono">{Math.round((1 - lambda) * 100)}%</span></div>
            </div>
            <p className="small muted">“We chose λ = 0.70, where the skill is more important than trustworthiness.” — TrueRank paper, eq. (3)</p>
          </Card>
        </div>
      </section>

      {o?.network?.points?.length > 0 && (
        <section className="section-tight">
          <div className="container">
            <div className="globe-card reveal">
              <div className="globe-copy">
                <span className="eyebrow" style={{ background: "rgba(255,255,255,.08)", color: "#fff", borderColor: "rgba(255,255,255,.15)" }}>
                  <LuDatabase /> Live worker network
                </span>
                <h2 style={{ color: "#fff" }}>Every point is a <span className="grad-text">real profile</span></h2>
                <p style={{ color: "var(--ink-300)" }}>
                  Each dot is a worker in the TrueRank database. Colour shows the trade, and brighter, larger dots have a
                  higher trust score. Drag to spin the network.
                  {onlyDemo && " (Currently showing the demo dataset.)"}
                </p>
                <div className="grid grid-2" style={{ "--gap": "18px", marginTop: 8 }}>
                  {[
                    ["Worker profiles", o.worker_profiles],
                    ["Trades", o.occupations],
                    ["Cities", o.cities],
                    ["Joined on TrueRank", o.worker_sources?.registered || 0],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.03em" }} className="grad-text">
                        <AnimatedNumber value={value} />
                      </div>
                      <div className="small strong" style={{ color: "var(--ink-300)" }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div className="globe-legend">
                  {o.network.occupations.slice(0, 10).map((name, i) => (
                    <span key={name}><i style={{ background: `hsl(${HUES[i % HUES.length]}, 92%, 60%)` }} />{name}</span>
                  ))}
                </div>
              </div>
              <div className="globe-stage">
                <Network3D network={o.network} height={480} />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <Cubes3D preset="section" network={false} />
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><LuUsers /> Three roles</span>
            <h2>One platform, three perspectives</h2>
          </div>
          <div className="grid grid-3">
            {[
              { icon: LuSearch, tone: "sky", title: "Service requester", art: "var(--grad-ocean)", to: "/register?role=requester", cta: "Find workers",
                items: ["Describe the job in plain language", "See ranked workers with skill, trust and TrueRank scores", "Select, track, rate and give feedback"] },
              { icon: LuHammer, tone: "amber", title: "Skilled worker", art: "var(--grad-trust)", to: "/register?role=worker", cta: "Create my profile",
                items: ["Describe your skills in your own words — no resume", "Accept or decline job requests", "Watch your trust score grow with every good job"] },
              { icon: LuChartColumn, tone: "pink", title: "Administrator", art: "var(--grad-brand)", to: "/login", cta: "Admin login",
                items: ["Monitor users, jobs, ratings and disputes", "Review verification requests", "Inspect trust metrics and matching statistics"] },
            ].map((r, i) => (
              <Card key={r.title} hover data-tilt className={`role-card reveal reveal-delay-${i + 1}`}>
                <div className="role-art" style={{ background: r.art }} />
                <IconBubble icon={r.icon} tone={r.tone} />
                <h3>{r.title}</h3>
                <ul>
                  {r.items.map((it) => (
                    <li key={it}><LuCircleCheck /> {it}</li>
                  ))}
                </ul>
                <div style={{ marginTop: "auto" }}>
                  <Button variant="soft" iconRight={LuArrowRight} to={r.to}>{r.cta}</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ paddingBottom: 96 }}>
        <div className="container">
          <div className="cta-band reveal">
            <Cubes3D preset="cta" network={false} />
            <div className="stack" style={{ "--gap": "10px", maxWidth: 620 }}>
              <h2>Let skill and reliability speak for themselves.</h2>
              <p style={{ opacity: 0.9 }}>Register in a minute. Workers never need to upload a resume.</p>
            </div>
            <div className="row">
              <Button size="lg" icon={LuUserCheck} to="/register" style={{ "--btn-bg": "#fff", "--btn-fg": "var(--violet-700)", "--btn-border": "#fff" }}>Create an account</Button>
              <Button size="lg" icon={LuBadgeCheck} to="/research" style={{ "--btn-bg": "rgba(255,255,255,.14)", "--btn-fg": "#fff", "--btn-border": "rgba(255,255,255,.4)" }}>See the research</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
