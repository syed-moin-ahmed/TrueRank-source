import { LuArrowRight, LuBriefcase, LuCircleCheck, LuCircleDashed, LuInbox, LuMedal, LuPercent, LuSparkles, LuStar, LuUserPen } from "react-icons/lu";
import { LineChart, ScoreRing } from "../../components/charts.jsx";
import { Button, Card, CardHeader, EmptyState, ErrorState, IconBubble, SkeletonCards, StatTile } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { useAuth } from "../../services/auth.jsx";
import { pct, rating, score, timeAgo, TRIGGER_LABEL } from "../../utils/format.js";
import Cubes3D from "../../components/Cubes3D.jsx";

export function NeedsProfile() {
  return (
    <Card className="anim-scale-in" style={{ padding: 40 }}>
      <EmptyState
        icon={LuUserPen}
        title="Create your worker profile"
        action={<Button variant="primary" size="lg" icon={LuUserPen} to="/worker/profile">Create profile</Button>}
      >
        Tell requesters what you can do in your own words. No resume or certificate needed — your skills, experience and
        future ratings are what TrueRank uses to match you.
      </EmptyState>
    </Card>
  );
}

export default function WorkerDashboard() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi("/dashboard/worker");
  const opps = useApi("/workers/me/opportunities");

  if (loading) return <SkeletonCards count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (data.needs_profile) return <NeedsProfile />;

  const p = data.profile;
  const m = p.metrics;
  const points = data.trust_history.map((h, i) => ({ label: i === 0 ? "start" : `#${i + 1}`, value: h.trust_score, note: TRIGGER_LABEL[h.trigger] || h.trigger }));

  return (
    <div className="stack" style={{ "--gap": "24px" }}>
      <Card className="card-gradient welcome anim-fade-up">
        <Cubes3D preset="welcome" network={false} />
        <div className="stack" style={{ "--gap": "8px" }}>
          <span className="tiny strong" style={{ opacity: 0.85, letterSpacing: ".08em", textTransform: "uppercase" }}>{p.occupation} · {p.city}</span>
          <h2>Welcome back, {user.name.split(" ")[0]}</h2>
          <p style={{ opacity: 0.9, maxWidth: 520 }}>
            {data.pending_requests > 0
              ? `You have ${data.pending_requests} new job request${data.pending_requests > 1 ? "s" : ""} waiting for your answer.`
              : "Keep your profile detailed — every word you write helps TF-IDF match you to the right requests."}
          </p>
          <div className="row mt-8">
            <Button to="/worker/requests" icon={LuInbox} style={{ "--btn-bg": "#fff", "--btn-fg": "var(--violet-700)", "--btn-border": "#fff" }}>View requests</Button>
            <Button to="/worker/profile" icon={LuUserPen} style={{ "--btn-bg": "rgba(255,255,255,.14)", "--btn-fg": "#fff", "--btn-border": "rgba(255,255,255,.4)" }}>Edit profile</Button>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,.95)", borderRadius: 24, padding: 14 }}>
          <ScoreRing value={p.trust_score} tone="trust" size={132} stroke={12} asDecimal sub="Trust score" />
        </div>
      </Card>

      <div className="grid grid-4 stagger">
        <StatTile label="Pending requests" value={data.pending_requests} icon={LuInbox} tone="sky" accent="var(--sky)" style={{ "--i": 0 }} />
        <StatTile label="Completed jobs" value={m.jobs_completed} icon={LuCircleCheck} tone="green" accent="var(--green)" style={{ "--i": 1 }} />
        <StatTile label="Average rating" value={m.average_rating ?? "No ratings"} format={(v) => rating(v)} icon={LuStar} tone="amber" accent="var(--amber)" foot={m.rating_count ? `${m.rating_count} ratings` : "Rate after first job"} style={{ "--i": 2 }} />
        <StatTile label="Completion rate" value={m.completion_rate ?? "No data"} format={(v) => pct(v)} icon={LuPercent} tone="pink" accent="var(--pink)" style={{ "--i": 3 }} />
      </div>

      <div className="grid split-even">
        <Card className="anim-fade-up">
          <CardHeader title="Profile completeness" icon={LuUserPen} tone="sky" action={<Button size="sm" variant="ghost" iconRight={LuArrowRight} to="/worker/profile">Improve</Button>} />
          <div className="completeness">
            <ScoreRing value={data.completeness.percent / 100} tone="sky" size={110} sub="complete" />
            <div className="check-list" style={{ flex: 1 }}>
              {data.completeness.checks.map((c) => (
                <span key={c.label} className={c.done ? "ok" : "todo"}>
                  {c.done ? <LuCircleCheck /> : <LuCircleDashed />} {c.label}
                </span>
              ))}
            </div>
          </div>
          <p className="tiny muted mt-16">Completeness is a guide for you only — it is not part of the trust score.</p>
        </Card>

        <Card className="anim-fade-up">
          <CardHeader title="Trust score over time" icon={LuSparkles} tone="amber" action={<Button size="sm" variant="ghost" iconRight={LuArrowRight} to="/worker/trust">Details</Button>} />
          {points.length > 1 ? <LineChart points={points} height={190} color={["#FFAD1F", "#FF4D8D"]} /> : <p className="small muted">Your trust history will grow as you complete jobs and receive ratings.</p>}
        </Card>
      </div>

      <div className="grid split-even">
        <Card className="anim-fade-up">
          <CardHeader title="Recommended opportunities" icon={LuBriefcase} tone="teal" subtitle="Open requests ranked by skill similarity to your profile" action={<Button size="sm" variant="ghost" iconRight={LuArrowRight} to="/worker/requests">All</Button>} />
          {opps.data?.items?.length ? (
            opps.data.items.slice(0, 4).map((o) => (
              <div className="list-row" key={o.id}>
                <IconBubble icon={LuBriefcase} tone="teal" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong truncate">{o.query_text}</div>
                  <div className="tiny muted">{o.city || "Any city"} · {timeAgo(o.created_at)}</div>
                </div>
                <span className="chip teal">S {score(o.similarity_score)}</span>
              </div>
            ))
          ) : (
            <p className="small muted">No open requests match your profile right now.</p>
          )}
        </Card>
        <Card className="anim-fade-up">
          <CardHeader title="How often TrueRank recommends you" icon={LuMedal} />
          <div className="grid grid-3" style={{ "--gap": "12px" }}>
            <div className="metric"><div className="m-label">Times ranked</div><div className="m-value">{data.appearances.n}</div></div>
            <div className="metric"><div className="m-label">Best rank</div><div className="m-value">{data.appearances.best_rank ? `#${data.appearances.best_rank}` : "—"}</div></div>
            <div className="metric"><div className="m-label">Avg rank</div><div className="m-value">{data.appearances.avg_rank ? data.appearances.avg_rank.toFixed(1) : "—"}</div></div>
          </div>
          <p className="small muted mt-16">
            Counted from real searches by requesters. Higher trust and a more detailed profile both improve your rank. <Link to="/worker/trust">See how trust is calculated →</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
