import { useState } from "react";
import { LuActivity, LuFlaskConical, LuPlay, LuSearch, LuTarget } from "react-icons/lu";
import { Alert, Button, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader, SkeletonCards, StatTile } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { post } from "../../services/api.js";
import { dateTime, score } from "../../utils/format.js";

function LambdaLab() {
  const [query, setQuery] = useState("I need an electrician to repair damaged wiring and a circuit breaker.");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(null);

  const run = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await post("/admin/lambda-experiment", { query, lambdas: [1.0, 0.7, 0.0], top_n: 6 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const titles = { 1: "λ = 1.0 · skill only", 0.7: "λ = 0.7 · TrueRank (paper)", 0: "λ = 0.0 · trust only" };

  return (
    <Card>
      <CardHeader title="λ experiment" icon={LuFlaskConical} tone="pink" subtitle="Rank the same query with different fusion weights to show the effect of eq. (3). Not logged." />
      <form className="row" onSubmit={run} style={{ marginBottom: 18 }}>
        <div className="input-icon" style={{ flex: 1, minWidth: 260 }}>
          <LuSearch />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={600} />
        </div>
        <Button type="submit" variant="primary" icon={LuPlay} loading={loading}>Compare</Button>
      </form>
      {error && <Alert type="error">{error}</Alert>}
      {result && (
        <div className="lambda-cols">
          {result.runs.map((run) => (
            <div key={run.lambda} className="stack" style={{ "--gap": "8px" }}>
              <div className="strong">{titles[run.lambda] ?? `λ = ${run.lambda}`}</div>
              <div className="formula" style={{ fontSize: ".8rem", padding: "10px 12px" }}>{run.formula}</div>
              {run.results.length === 0 && <p className="small muted">No results.</p>}
              {run.results.map((r, i) => (
                <div
                  key={r.worker_id}
                  className={`lambda-item ${hover === r.worker_id ? "hl" : ""}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  onMouseEnter={() => setHover(r.worker_id)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className="strong mono">#{r.rank}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{r.name}</div>
                    <div className="tiny muted mono">S {score(r.similarity_score)} · TS {score(r.trust_score)}</div>
                  </div>
                  <span className="mono strong text-rank">{score(r.final_score)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {result && <p className="tiny muted mt-16">Hover a worker to see where they appear in each ranking.</p>}
    </Card>
  );
}

export default function AdminMatching() {
  useDocumentTitle("Matching statistics");
  const { data, error, loading, reload } = useApi("/admin/matching");

  return (
    <div className="stack" style={{ "--gap": "24px" }}>
      <PageHeader title="Matching statistics" subtitle="Every execution of the TrueRank pipeline is logged in match_logs and match_results." />
      {loading && <SkeletonCards count={2} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid grid-4 stagger">
            <StatTile label="Pipeline runs" value={data.summary.runs} icon={LuActivity} tone="teal" accent="var(--teal)" style={{ "--i": 0 }} />
            <StatTile label="Avg workers above τ" value={data.summary.avg_candidates ?? "—"} format={(v) => v.toFixed(1)} icon={LuTarget} accent="var(--violet)" style={{ "--i": 1 }} />
            <StatTile label="Avg top-1 similarity" value={data.summary.avg_similarity ?? "—"} format={(v) => v.toFixed(3)} icon={LuSearch} tone="teal" accent="var(--teal)" style={{ "--i": 2 }} />
            <StatTile label="Avg rank of selected worker" value={data.selections.avg_rank ?? "—"} format={(v) => v.toFixed(2)} icon={LuTarget} tone="amber" accent="var(--amber)" foot={`${data.selections.n} selections from ranked lists`} style={{ "--i": 3 }} />
          </div>
          <LambdaLab />
          <Card className="card-flush">
            <div style={{ padding: "22px 22px 0" }}>
              <CardHeader title="Recent pipeline runs" icon={LuActivity} />
            </div>
            {data.logs.length === 0 ? (
              <EmptyState icon={LuActivity} title="No searches yet" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Query</th><th>Processed terms</th><th>Requester</th><th className="num">Above τ</th><th className="num">Shown</th><th>Top worker</th><th>When</th></tr></thead>
                  <tbody>
                    {data.logs.map((l) => (
                      <tr key={l.id}>
                        <td style={{ maxWidth: 280 }}>{l.query_text}</td>
                        <td className="mono tiny" style={{ maxWidth: 220 }}>{l.processed_query}</td>
                        <td>{l.requester_name || "—"}</td>
                        <td className="num">{l.candidates_above_threshold}</td>
                        <td className="num">{l.results_returned}</td>
                        <td>{l.top_worker ? `${l.top_worker} (${score(l.top_score)})` : "—"}</td>
                        <td className="nowrap small">{dateTime(l.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
