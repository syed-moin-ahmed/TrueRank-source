import { LuCircleCheck, LuCode, LuLightbulb, LuSparkles, LuTarget, LuTriangleAlert } from "react-icons/lu";
import { Card, CardHeader } from "../../components/ui.jsx";
import { useDocumentTitle, useReveal } from "../../hooks/index.js";
import Cubes3D from "../../components/Cubes3D.jsx";
import VerifiedTick from "../../components/VerifiedTick.jsx";

const OBJECTIVES = [
  "Develop TrueRank, a machine learning framework for matching informal workers to industry demand based on their skills and performance.",
  "Use NLP to analyse unstructured worker profiles and client feedback, extracting relevant skill and performance information.",
  "Combine TF-IDF-based skill matching with a Composite Trust Score derived from ratings, job-completion rate, peer endorsements and dispute history.",
  "Rank informal workers by both skill relevance and behavioural reliability, so industries can identify suitable workers without depending solely on formal resumes or certifications.",
  "Improve the accuracy and reliability of worker-to-industry matching while creating better opportunities for skilled informal workers.",
];

const STACK = [
  ["Frontend", "React.js, hand-written CSS design system, esbuild"],
  ["Backend", "Python, Flask REST API, JWT authentication"],
  ["NLP / ML", "scikit-learn (TF-IDF, cosine similarity), NLTK (stop words, WordNet lemmatizer), NumPy"],
  ["Database", "SQLite (relational schema with foreign keys and constraints)"],
  ["Tooling", "Git / GitHub, unittest"],
];

export default function About() {
  useDocumentTitle("About");
  useReveal([]);
  return (
    <>
      <section className="section page-hero" style={{ paddingBottom: 30 }}>
        <div className="blobs"><div className="blob b1" /><div className="blob b4" /></div>
        <Cubes3D preset="banner" />
        <div className="container section-head anim-fade-up" style={{ position: "relative" }}>
          <span className="eyebrow"><LuSparkles /> About TrueRank</span>
          <h1 style={{ fontSize: "clamp(1.8rem, 2.6vw + 1rem, 2.8rem)" }}>TrueRank: Trust-Aware NLP Framework for Matching Informal Workers to Industry Demand</h1>
          <p className="lead">A platform that helps skilled informal workers get discovered for what they can actually do — and helps people and industries find workers they can trust.</p>
        </div>
      </section>
      <section className="section-tight" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="founder-card reveal">
            <div className="founder-photo">
              <img src="/founder.jpg" alt="Syed Moin Ahmed" width="160" height="160" />
            </div>
            <div className="founder-body">
              <span className="founder-role"><LuLightbulb /> Founder &amp; Developer</span>
              <div className="founder-name-row">
                <h2 className="founder-name">Syed Moin Ahmed</h2>
                <VerifiedTick size={34} />
              </div>
              <p className="founder-text">
                Conceived the TrueRank idea and built the platform end to end — from the trust-aware NLP framework to the
                working web application.
              </p>
              <div className="founder-tags">
                <span><LuLightbulb /> Idea &amp; research</span>
                <span><LuSparkles /> NLP &amp; trust model</span>
                <span><LuCode /> Full-stack build</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="section-tight" style={{ paddingBottom: 96 }}>
        <div className="container grid grid-2">
          <Card className="reveal">
            <CardHeader title="Problem statement" icon={LuTriangleAlert} tone="pink" />
            <div className="stack small" style={{ "--gap": "10px", color: "var(--ink-700)" }}>
              <p>Informal-sector workers — plumbers, electricians, carpenters — often lack formal resumes and verifiable credentials, limiting access to digital hiring platforms despite their practical expertise.</p>
              <p>Existing recruitment systems mainly depend on structured resumes and formal qualifications, making them unsuitable for assessing informal workers.</p>
              <p>There is a need for a system that can assess workers using unstructured profile information, client feedback and performance history.</p>
              <p>TrueRank addresses this using NLP-based skill matching and a Composite Trust Score to rank informal workers by skill relevance and behavioural reliability.</p>
            </div>
          </Card>
          <Card className="reveal reveal-delay-1">
            <CardHeader title="Objectives" icon={LuTarget} tone="teal" />
            <ol className="stack small" style={{ "--gap": "10px", paddingLeft: 18, margin: 0, color: "var(--ink-700)" }}>
              {OBJECTIVES.map((o) => <li key={o}>{o}</li>)}
            </ol>
          </Card>
          <Card className="reveal">
            <CardHeader title="Technology" icon={LuCode} tone="sky" />
            <dl className="kv">
              {STACK.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd style={{ textAlign: "left", fontWeight: 600 }}>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="reveal reveal-delay-1">
            <CardHeader title="What makes TrueRank different" icon={LuCircleCheck} tone="green" />
            <ul className="stack small" style={{ "--gap": "10px", listStyle: "none", padding: 0, margin: 0, color: "var(--ink-700)" }}>
              {[
                "No resume or certificate needed — workers describe their skills in their own words.",
                "Natural-language search: describe the job, TrueRank understands it.",
                "Every recommendation shows its skill similarity, trust score and the reasons behind it.",
                "Ratings, completed jobs, peer endorsements and disputes keep trust scores up to date.",
              ].map((t) => (
                <li key={t} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", "--gap": "10px" }}>
                  <LuCircleCheck style={{ width: 18, height: 18, color: "var(--green)", flexShrink: 0, marginTop: 2 }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </>
  );
}
