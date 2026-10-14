import {
  LuActivity, LuBadgeCheck, LuBriefcase, LuChartColumn, LuCircleCheck, LuClipboardList, LuFlag, LuShieldCheck, LuSparkles, LuStar, LuUsers,
} from "react-icons/lu";
import { BarChart, Donut, HBars, LineChart } from "../../components/charts.jsx";
import { Card, CardHeader, ErrorState, PageHeader, SkeletonCards, StatTile } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { rating, score } from "../../utils/format.js";

const STATUS_COLORS = {
  pending: "#2E9BFF", accepted: "#6C47FF", in_progress: "#FFAD1F", completed: "#17B26A",
  rejected: "#8E8AA8", withdrawn: "#FF7A45", cancelled: "#8E8AA8",
};
const SOURCE_COLORS = { demo_seed: "#FFAD1F", research_dataset: "#2E9BFF", registered: "#6C47FF" };
const SOURCE_LABELS = { demo_seed: "Demo data", research_dataset: "Imported dataset", registered: "Registered" };

function lastDays(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function AdminDashboard() {
  useDocumentTitle("Admin dashboard");
  const { data, error, loading, reload } = useApi("/admin/stats");
  if (loading) return <SkeletonCards count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const t = data.totals;

  const activity = Object.fromEntries(data.matching_activity.map((a) => [a.day, a.n]));
  const activityPoints = lastDays(14).map((d) => ({ label: d.slice(5), value: activity[d] || 0 }));
  const maxActivity = Math.max(4, ...activityPoints.map((p) => p.value));

  return (
    <div className="stack" style={{ "--gap": "24px" }}>
      <PageHeader title="System overview" subtitle="Live statistics from the TrueRank database." />

      <div className="grid grid-4 stagger">
        <StatTile label="Total workers" value={t.workers} icon={LuBriefcase} tone="amber" accent="var(--amber)" foot={`${t.registered_workers} registered on the site`} style={{ "--i": 0 }} />
        <StatTile label="Service requesters" value={t.service_requesters} icon={LuUsers} tone="sky" accent="var(--sky)" style={{ "--i": 1 }} />
        <StatTile label="Service requests" value={t.service_requests} icon={LuClipboardList} accent="var(--violet)" style={{ "--i": 2 }} />
        <StatTile label="Completed jobs" value={t.completed_jobs} icon={LuCircleCheck} tone="green" accent="var(--green)" style={{ "--i": 3 }} />
        <StatTile label="Avg worker rating" value={t.average_worker_rating ?? "—"} format={(v) => rating(v)} icon={LuStar} tone="amber" accent="var(--amber)" style={{ "--i": 4 }} />
        <StatTile label="Avg trust score" value={t.average_trust_score ?? "—"} format={(v) => score(v)} icon={LuShieldCheck} tone="pink" accent="var(--pink)" style={{ "--i": 5 }} />
        <StatTile label="Matching runs" value={t.matches_run} icon={LuSparkles} tone="teal" accent="var(--teal)" style={{ "--i": 6 }} />
        <Link to="/admin/disputes" style={{ color: "inherit", "--i": 7 }}>
          <StatTile label="Open disputes" value={t.open_disputes} icon={LuFlag} tone="red" accent="var(--red)" foot={`${t.pending_verifications} verification requests pending`} />
        </Link>
      </div>

      <div className="grid split-main">
        <Card className="anim-fade-up">
          <CardHeader title="Trust-score distribution" icon={LuShieldCheck} tone="amber" subtitle="20 bins over [0, 1], like the paper’s Fig. 5 histogram" />
          <BarChart
            items={data.trust_distribution.map((b) => ({ label: b.from.toFixed(2), value: b.count }))}
            labelEvery={4}
            colors={["#FFAD1F", "#FF4D8D"]}
            showValues={false}
            height={250}
          />
        </Card>
        <Card className="anim-fade-up">
          <CardHeader title="Job status" icon={LuChartColumn} />
          {Object.keys(data.job_status).length ? (
            <Donut
              items={Object.entries(data.job_status).map(([k, v]) => ({ label: k.replace("_", " "), value: v, color: STATUS_COLORS[k] }))}
              centerLabel="jobs"
            />
          ) : (
            <p className="small muted">No jobs yet.</p>
          )}
        </Card>
      </div>

      <div className="grid split-main">
        <Card className="anim-fade-up">
          <CardHeader title="Matching activity" icon={LuActivity} tone="teal" subtitle="TrueRank pipeline runs per day (last 14 days)" />
          <LineChart points={activityPoints} min={0} max={maxActivity} format={(v) => Math.round(v)} height={220} color={["#00BFA6", "#2E9BFF"]} />
        </Card>
        <Card className="anim-fade-up">
          <CardHeader title="Worker sources" icon={LuBadgeCheck} tone="sky" />
          <Donut
            items={Object.entries(data.worker_sources).map(([k, v]) => ({ label: SOURCE_LABELS[k] || k, value: v, color: SOURCE_COLORS[k] }))}
            centerLabel="profiles"
          />
        </Card>
      </div>

      <Card className="anim-fade-up">
        <CardHeader title="Top occupations" icon={LuBriefcase} tone="amber" />
        <HBars items={data.top_occupations.map((o) => ({ label: o.occupation, value: o.n }))} />
      </Card>
    </div>
  );
}
