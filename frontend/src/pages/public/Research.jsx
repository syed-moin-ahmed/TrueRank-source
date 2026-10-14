import { LuBookOpen, LuChartColumn, LuFlaskConical, LuLayers } from "react-icons/lu";
import { BarChart, HBars } from "../../components/charts.jsx";
import { Card, CardHeader, ErrorState, PageLoader } from "../../components/ui.jsx";
import { useApi, useDocumentTitle, useReveal } from "../../hooks/index.js";
import Cubes3D from "../../components/Cubes3D.jsx";
import ExistingVsProposed from "../../components/ExistingVsProposed.jsx";

const MODEL_COLORS = ["#B9B6CF", "#8E8AA8", "#2E9BFF", "#FFAD1F", "#6C47FF"];

export default function Research() {
  useDocumentTitle("Research");
  const { data, error, loading, reload } = useApi("/meta/research-results");
  useReveal([data]);

  return (
    <>
      <section className="section page-hero" style={{ paddingBottom: 30 }}>
        <div className="blobs"><div className="blob b2" /><div className="blob b3" /></div>
        <Cubes3D preset="banner" />
        <div className="container section-head anim-fade-up" style={{ position: "relative" }}>
          <span className="eyebrow"><LuBookOpen /> Research results</span>
          <h1 style={{ fontSize: "clamp(2rem, 3vw + 1rem, 3rem)" }}>TrueRank <span className="grad-text">outperforms</span> the baselines</h1>
          <p className="lead">Evaluated on 1,500 informal worker profiles, TrueRank achieves 90.6% accuracy — ahead of Naïve Bayes, Logistic Regression, SVM and Random Forest.</p>
        </div>
      </section>

      <section className="section-tight" style={{ paddingBottom: 96 }}>
        <div className="container stack" style={{ "--gap": "24px" }}>
          {loading && <PageLoader />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {data && (
            <>
              <ExistingVsProposed data={data} />

              <div className="grid grid-2">
                <Card className="reveal">
                  <CardHeader title="Accuracy by model (Fig. 3)" icon={LuChartColumn} subtitle={data.dataset} />
                  <BarChart
                    items={data.model_comparison.map((m, i) => ({ label: m.model.replace(" (Proposed)", ""), value: m.accuracy, color: MODEL_COLORS[i] }))}
                    max={100}
                    format={(v) => `${Math.round(v * 10) / 10}`}
                    height={260}
                  />
                </Card>
                <Card className="reveal reveal-delay-1">
                  <CardHeader title="Component isolation (Table 2)" icon={LuLayers} tone="amber" subtitle="Accuracy when one part of the pipeline is removed" />
                  <HBars
                    items={data.component_isolation.map((c, i) => ({ label: c.variant, value: c.accuracy, display: `${c.accuracy}%`, tone: i === 0 ? "" : "trust" }))}
                    max={100}
                  />
                  <p className="small muted mt-16">Each variant removes one part of the full model (90.6%). The TF-IDF-only baseline is the lowest at 78.4%.</p>
                </Card>
              </div>

              <Card className="card-flush reveal">
                <div style={{ padding: "22px 22px 0" }}>
                  <CardHeader title="Model performance comparison (Table 1)" icon={LuFlaskConical} tone="sky" />
                </div>
                <div className="table-wrap">
                  <table className="table paper-table">
                    <thead>
                      <tr><th>Model</th><th className="num">Accuracy</th><th className="num">Precision</th><th className="num">Recall</th><th className="num">F1-score</th></tr>
                    </thead>
                    <tbody>
                      {data.model_comparison.map((m) => (
                        <tr key={m.model} className={m.model.startsWith("TrueRank") ? "hl" : ""}>
                          <td className="strong">{m.model}</td>
                          <td className="num">{m.accuracy.toFixed(1)}%</td>
                          <td className="num">{m.precision.toFixed(1)}%</td>
                          <td className="num">{m.recall.toFixed(1)}%</td>
                          <td className="num">{m.f1.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="card-gradient reveal" style={{ padding: 30 }}>
                <div className="stack" style={{ "--gap": "10px" }}>
                  <h3 style={{ color: "#fff" }}>From research concept to working system</h3>
                  <p style={{ opacity: 0.92 }}>
                    This website is the working implementation of the TrueRank framework: every search runs the same pipeline —
                    preprocessing, TF-IDF, cosine similarity, the Composite Trust Score, score fusion and ranking — live on the
                    worker profiles in its database.
                  </p>
                </div>
              </Card>
            </>
          )}
        </div>
      </section>
    </>
  );
}
