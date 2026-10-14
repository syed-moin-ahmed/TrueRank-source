import { LuArrowRight, LuCircleCheck, LuClipboardList, LuHistory, LuSearch, LuSparkles, LuStar, LuUsers } from "react-icons/lu";
import { WorkerRow } from "../../components/truerank.jsx";
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonCards, StatTile, StatusPill } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { useAuth } from "../../services/auth.jsx";
import { pct, score, timeAgo } from "../../utils/format.js";
import Cubes3D from "../../components/Cubes3D.jsx";

export default function RequesterDashboard() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi("/dashboard/requester");

  if (loading) return <SkeletonCards count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const c = data.counts;

  return (
    <div className="stack" style={{ "--gap": "24px" }}>
      <Card className="card-gradient welcome anim-fade-up">
        <Cubes3D preset="welcome" network={false} />
        <div className="stack" style={{ "--gap": "8px" }}>
          <span className="tiny strong" style={{ opacity: 0.85, letterSpacing: ".08em", textTransform: "uppercase" }}>Service requester</span>
          <h2>Hello, {user.name.split(" ")[0]} 👋</h2>
          <p style={{ opacity: 0.9, maxWidth: 520 }}>Describe a job in plain words and TrueRank will rank workers by skill similarity and trust.</p>
        </div>
        <Button size="lg" icon={LuSearch} to="/requester/find" style={{ "--btn-bg": "#fff", "--btn-fg": "var(--violet-700)", "--btn-border": "#fff" }}>
          Find a worker
        </Button>
      </Card>

      <div className="grid grid-4 stagger">
        <StatTile label="Active requests" value={c.active_requests} icon={LuClipboardList} tone="sky" accent="var(--sky)" style={{ "--i": 0 }} />
        <StatTile label="Completed jobs" value={c.completed_jobs} icon={LuCircleCheck} tone="green" accent="var(--green)" style={{ "--i": 1 }} />
        <StatTile label="Ratings given" value={c.reviews_given} icon={LuStar} tone="amber" accent="var(--amber)" style={{ "--i": 2 }} />
        <StatTile label="Searches run" value={c.matches_run} icon={LuSparkles} tone="pink" accent="var(--pink)" style={{ "--i": 3 }} />
      </div>

      <div className="grid grid-2">
        <Card className="anim-fade-up">
          <CardHeader title="Recent requests" icon={LuClipboardList} tone="sky" action={<Button size="sm" variant="ghost" iconRight={LuArrowRight} to="/requester/requests">All</Button>} />
          {data.recent_requests.length === 0 ? (
            <EmptyState icon={LuClipboardList} title="No requests yet" action={<Button variant="primary" icon={LuSearch} to="/requester/find">Create your first request</Button>} />
          ) : (
            <ul className="list-plain">
              {data.recent_requests.map((r) => (
                <li key={r.id}>
                  <Link to={`/requester/requests/${r.id}`} className="list-row clickable-row" style={{ color: "inherit" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="strong truncate">{r.query_text}</div>
                      <div className="tiny muted">{r.worker_name ? `Worker: ${r.worker_name}` : "No worker selected"} · {timeAgo(r.created_at)}</div>
                    </div>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="stack" style={{ "--gap": "24px" }}>
          <Card className="anim-fade-up">
            <CardHeader title="Recent recommendations" icon={LuHistory} />
            {data.recent_matches.length === 0 ? (
              <p className="small muted">Your searches will appear here.</p>
            ) : (
              <ul className="list-plain">
                {data.recent_matches.map((m) => (
                  <li key={m.id} className="list-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="strong truncate small">“{m.query_text}”</div>
                      <div className="tiny muted">
                        {m.results_returned} workers ranked · top: {m.top_worker || "—"} {m.top_score !== null && `(${score(m.top_score)})`}
                      </div>
                    </div>
                    <span className="tiny muted nowrap">{timeAgo(m.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="anim-fade-up">
            <CardHeader title="Workers you have hired" icon={LuUsers} tone="amber" />
            {data.recent_workers.length === 0 ? (
              <p className="small muted">Workers you select will appear here.</p>
            ) : (
              data.recent_workers.map((w) => (
                <WorkerRow key={`${w.id}-${w.job_status}`} worker={w} to={`/workers/${w.id}`} right={<span className="chip amber">TS {pct(w.trust_score)}</span>} />
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
