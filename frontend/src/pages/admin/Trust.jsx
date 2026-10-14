import { LuArrowDown, LuArrowUp, LuHistory, LuShieldCheck, LuSlidersHorizontal } from "react-icons/lu";
import { BarChart, HBars } from "../../components/charts.jsx";
import { TrustFormula } from "../../components/truerank.jsx";
import { Card, CardHeader, ErrorState, PageHeader, SkeletonCards } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { pct, score, timeAgo, TRIGGER_LABEL } from "../../utils/format.js";

function WorkerTable({ rows }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Worker</th><th className="num">AR</th><th className="num">CR</th><th className="num">PE</th><th className="num">DA</th><th className="num">TS</th></tr></thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id}>
              <td><Link to={`/workers/${w.id}`}>{w.name}</Link><div className="tiny muted">{w.occupation} · {w.city}</div></td>
              {["trust_ar", "trust_cr", "trust_pe", "trust_da"].map((k) => (
                <td key={k} className="num">{w[k] === null ? <span className="muted">n/a</span> : pct(w[k])}</td>
              ))}
              <td className="num strong">{score(w.trust_score, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminTrust() {
  useDocumentTitle("Trust metrics");
  const { data, error, loading, reload } = useApi("/admin/trust-metrics");
  if (loading) return <SkeletonCards count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const a = data.averages;
  const c = data.config;

  return (
    <div className="stack" style={{ "--gap": "24px" }}>
      <PageHeader title="Trust metrics" subtitle="How the Composite Trust Score is distributed across all workers." />
      <div className="grid split-main">
        <Card className="anim-fade-up">
          <CardHeader title="Average component values" icon={LuShieldCheck} tone="amber" subtitle={`Over ${a.workers} workers (components with no data are excluded from each average)`} />
          <HBars
            max={1}
            tone="trust"
            items={[
              { label: "Average Rating (AR)", value: a.ar, display: pct(a.ar) },
              { label: "Completion Rate (CR)", value: a.cr, display: pct(a.cr) },
              { label: "Peer Endorsements (PE)", value: a.pe, display: pct(a.pe) },
              { label: "Dispute Adjustment (DA)", value: a.da, display: pct(a.da) },
              { label: "Trust Score (TS)", value: a.ts, display: score(a.ts), tone: "" },
            ]}
          />
          <p className="tiny muted mt-16">Workers without data: AR {a.ar_missing} · CR {a.cr_missing} · DA {a.da_missing} (neutral prior {c.neutral_prior} used).</p>
        </Card>
        <Card className="anim-fade-up">
          <CardHeader title="Active configuration" icon={LuSlidersHorizontal} />
          <div className="stack">
            <TrustFormula weights={c.trust_weights} />
            <dl className="kv">
              <dt>PE cap</dt><dd>{c.pe_cap} endorsements</dd>
              <dt>Neutral prior</dt><dd>{c.neutral_prior}</dd>
              <dt>λ (ranking)</dt><dd>{c.lambda}</dd>
              <dt>Similarity threshold τ</dt><dd>{c.min_similarity}</dd>
            </dl>
          </div>
        </Card>
      </div>

      <Card className="anim-fade-up">
        <CardHeader title="Distribution (20 bins)" icon={LuShieldCheck} tone="amber" />
        <BarChart items={data.distribution.map((b) => ({ label: b.from.toFixed(2), value: b.count }))} labelEvery={2} colors={["#FFAD1F", "#FF4D8D"]} showValues={false} height={240} />
      </Card>

      <div className="grid split-even">
        <Card className="card-flush anim-fade-up">
          <div style={{ padding: "22px 22px 0" }}><CardHeader title="Highest trust" icon={LuArrowUp} tone="green" /></div>
          <WorkerTable rows={data.top} />
        </Card>
        <Card className="card-flush anim-fade-up">
          <div style={{ padding: "22px 22px 0" }}><CardHeader title="Lowest trust" icon={LuArrowDown} tone="red" /></div>
          <WorkerTable rows={data.bottom} />
        </Card>
      </div>

      <div className="grid split-even">
        <Card className="anim-fade-up">
          <CardHeader title="Average trust by occupation" icon={LuShieldCheck} />
          <HBars max={1} tone="trust" items={data.by_occupation.map((o) => ({ label: `${o.occupation} (${o.workers})`, value: o.avg_trust, display: score(o.avg_trust) }))} />
        </Card>
        <Card className="anim-fade-up">
          <CardHeader title="Recent trust recalculations" icon={LuHistory} tone="sky" subtitle="Live feedback-loop events" />
          {data.recent_updates.length === 0 ? (
            <p className="small muted">No platform events yet. Ratings, completed jobs, disputes and endorsements will appear here.</p>
          ) : (
            <ul className="list-plain">
              {data.recent_updates.map((u) => (
                <li key={u.id} className="list-row small">
                  <span className="dot" style={{ background: "var(--amber)" }} />
                  <Link to={`/workers/${u.worker_id}`} className="strong">{u.worker_name}</Link>
                  <span className="muted" style={{ flex: 1 }}>{TRIGGER_LABEL[u.trigger] || u.trigger}</span>
                  <span className="mono strong">{score(u.trust_score, 3)}</span>
                  <span className="tiny muted nowrap">{timeAgo(u.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
