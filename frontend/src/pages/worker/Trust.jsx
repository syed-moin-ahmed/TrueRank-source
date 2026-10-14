import { LuHistory, LuLightbulb, LuShieldCheck } from "react-icons/lu";
import { LineChart, ScoreRing } from "../../components/charts.jsx";
import { TrustBreakdown, TrustFormula } from "../../components/truerank.jsx";
import { Card, CardHeader, ErrorState, PageHeader, SkeletonCards } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { dateTime, TRIGGER_LABEL } from "../../utils/format.js";
import { NeedsProfile } from "./Dashboard.jsx";

const TIPS = {
  AR: "Do careful work and ask customers to rate you after each job.",
  CR: "Finish the jobs you accept. Withdrawing after accepting lowers this.",
  PE: "Ask fellow workers who know your work to endorse you.",
  DA: "Clear communication avoids disputes. Dismissed disputes do not count.",
};

export default function WorkerTrust() {
  useDocumentTitle("Trust score");
  const me = useApi("/workers/me");
  const id = me.data?.profile?.id;
  const history = useApi(id ? `/workers/${id}/trust-history` : null);

  if (me.loading) return <SkeletonCards count={2} />;
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />;
  if (me.data.needs_profile) return <NeedsProfile />;

  const p = me.data.profile;
  const t = p.trust;
  const items = history.data?.items || [];
  const points = items.map((h, i) => ({ label: i === 0 ? "start" : `#${i + 1}`, value: h.trust_score, note: TRIGGER_LABEL[h.trigger] || h.trigger }));
  const weakest = [...t.components].sort((a, b) => (a.has_data ? a.value : -1) - (b.has_data ? b.value : -1))[0];

  return (
    <>
      <PageHeader title="Your Composite Trust Score" subtitle="Calculated by the backend from your real work outcomes. It makes up 30% of your TrueRank score in every search." />
      <div className="grid split-main">
        <div className="stack" style={{ "--gap": "22px" }}>
          <Card className="anim-fade-up">
            <div className="row" style={{ "--gap": "28px" }}>
              <ScoreRing value={t.score} tone="trust" size={170} stroke={15} asDecimal sub="TS(w)" />
              <div className="stack" style={{ flex: 1, minWidth: 240 }}>
                <TrustFormula weights={Object.fromEntries(t.components.map((c) => [c.key, c.weight]))} />
                <p className="small muted">
                  {t.components.map((c) => `${c.weight.toFixed(2)}×${c.used_value.toFixed(3)}`).join(" + ")} = <strong className="mono">{t.score.toFixed(3)}</strong>
                </p>
                {!t.has_full_data && <p className="small" style={{ color: "#7a4a00" }}>Some components have no data yet, so a neutral value of {t.neutral_prior.toFixed(2)} is used for them.</p>}
              </div>
            </div>
          </Card>
          <Card className="anim-fade-up">
            <CardHeader title="Breakdown" icon={LuShieldCheck} tone="amber" />
            <TrustBreakdown trust={t} />
          </Card>
          <Card className="anim-fade-up">
            <CardHeader title="History" icon={LuHistory} subtitle="Each point is a stored recalculation" />
            {points.length > 1 ? <LineChart points={points} height={220} color={["#FFAD1F", "#FF4D8D"]} /> : <p className="small muted">Your first change will appear after your first completed job or rating.</p>}
            <ul className="list-plain mt-16">
              {[...items].reverse().slice(0, 8).map((h, i) => (
                <li className="list-row small" key={i}>
                  <span className="dot" style={{ background: "var(--amber)" }} />
                  <span style={{ flex: 1 }}>{TRIGGER_LABEL[h.trigger] || h.trigger}</span>
                  <span className="mono strong">{h.trust_score.toFixed(3)}</span>
                  <span className="tiny muted">{dateTime(h.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="stack" style={{ "--gap": "22px" }}>
          <Card className="card-dark anim-fade-up">
            <CardHeader title={<span style={{ color: "#fff" }}>Biggest opportunity</span>} icon={LuLightbulb} tone="amber" />
            <h3 style={{ color: "#fff" }}>{weakest.label}</h3>
            <p className="muted small mt-8">{weakest.has_data ? `Currently ${(weakest.value * 100).toFixed(0)}%. ` : "No data yet. "}{TIPS[weakest.key]}</p>
          </Card>
          <Card className="anim-fade-up">
            <CardHeader title="What each part means" icon={LuShieldCheck} />
            <div className="stack small" style={{ "--gap": "12px" }}>
              {t.components.map((c) => (
                <div key={c.key}>
                  <div className="strong">{c.label} <span className="muted mono">({c.key}, weight {c.weight.toFixed(2)})</span></div>
                  <div className="muted">{TIPS[c.key]}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
