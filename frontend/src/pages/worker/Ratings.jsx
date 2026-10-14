import { LuMessageSquare, LuStar } from "react-icons/lu";
import { BarChart } from "../../components/charts.jsx";
import { Avatar, Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonCards, Stars } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { rating, timeAgo } from "../../utils/format.js";
import { NeedsProfile } from "./Dashboard.jsx";

export default function WorkerRatings() {
  useDocumentTitle("Ratings");
  const me = useApi("/workers/me");
  const id = me.data?.profile?.id;
  const reviews = useApi(id ? `/workers/${id}/reviews` : null);

  if (me.loading) return <SkeletonCards count={2} />;
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />;
  if (me.data.needs_profile) return <NeedsProfile />;

  const p = me.data.profile;
  const items = reviews.data?.items || [];
  const dist = [1, 2, 3, 4, 5].map((s) => ({ label: `${s}★`, value: items.filter((r) => r.rating === s).length }));

  return (
    <>
      <PageHeader title="Ratings & feedback" subtitle="Ratings from requesters on this platform. They update your Average Rating (AR) immediately." />
      <div className="grid split-aside">
        <div className="stack" style={{ "--gap": "22px" }}>
          <Card className="center anim-fade-up">
            <div className="stack" style={{ alignItems: "center", "--gap": "8px" }}>
              <span className="tiny strong muted">OVERALL AVERAGE</span>
              <span style={{ fontSize: "3.2rem", fontWeight: 800, letterSpacing: "-0.04em" }} className="grad-text">{rating(p.metrics.average_rating)}</span>
              <Stars value={p.metrics.average_rating} size={22} />
              <span className="small muted">{p.metrics.rating_count} ratings in total{p.source !== "registered" ? " (including dataset baseline)" : ""}</span>
            </div>
          </Card>
          <Card className="anim-fade-up">
            <CardHeader title="Platform ratings" icon={LuStar} tone="amber" />
            {items.length ? <BarChart items={dist} height={180} colors={["#FFAD1F", "#FF7A45"]} /> : <p className="small muted">No platform ratings yet.</p>}
          </Card>
        </div>
        <Card className="anim-fade-up">
          <CardHeader title="Feedback from requesters" icon={LuMessageSquare} tone="green" />
          {reviews.loading && <SkeletonCards count={2} height={70} />}
          {items.length === 0 && !reviews.loading && <EmptyState icon={LuStar} title="No feedback yet">Complete your first job to receive a rating.</EmptyState>}
          <ul className="list-plain stagger">
            {items.map((r, i) => (
              <li key={r.id} className="list-row" style={{ alignItems: "flex-start", "--i": i }}>
                <Avatar name={r.requester_name} size="sm" />
                <div style={{ flex: 1 }}>
                  <div className="row-between">
                    <span className="strong">{r.requester_name}</span>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="small mt-8">“{r.comment}”</p>}
                  <div className="tiny muted mt-8">For: {r.query_text} · {timeAgo(r.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
