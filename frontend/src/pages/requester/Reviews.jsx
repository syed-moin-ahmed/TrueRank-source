import { LuFlag, LuStar } from "react-icons/lu";
import { Avatar, Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonCards, Stars, StatusPill } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { timeAgo } from "../../utils/format.js";

export default function RequesterReviews() {
  useDocumentTitle("Ratings & feedback");
  const reviews = useApi("/reviews");
  const disputes = useApi("/disputes");

  return (
    <>
      <PageHeader title="Ratings & feedback" subtitle="Every rating and dispute you submit feeds the workers’ Composite Trust Score." />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card>
          <CardHeader title="Ratings you gave" icon={LuStar} tone="amber" />
          {reviews.loading && <SkeletonCards count={2} height={70} />}
          {reviews.error && <ErrorState error={reviews.error} onRetry={reviews.reload} />}
          {reviews.data && reviews.data.items.length === 0 && <EmptyState icon={LuStar} title="No ratings yet">After a job is completed you can rate the worker.</EmptyState>}
          <ul className="list-plain stagger">
            {reviews.data?.items.map((r, i) => (
              <li key={r.id} className="list-row" style={{ alignItems: "flex-start", "--i": i }}>
                <Avatar name={r.worker_name} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-between">
                    <Link to={`/workers/${r.worker_id}`} className="strong">{r.worker_name}</Link>
                    <Stars value={r.rating} />
                  </div>
                  <div className="tiny muted">{r.worker_occupation} · {timeAgo(r.created_at)}</div>
                  {r.comment && <p className="small mt-8">“{r.comment}”</p>}
                  <p className="tiny muted mt-8 truncate">Request: {r.query_text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Disputes you reported" icon={LuFlag} tone="red" />
          {disputes.data && disputes.data.items.length === 0 && <EmptyState icon={LuFlag} title="No disputes" tone="green">Hopefully it stays that way.</EmptyState>}
          <ul className="list-plain">
            {disputes.data?.items.map((d) => (
              <li key={d.id} className="list-row" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div className="row-between">
                    <span className="strong">{d.worker_name}</span>
                    <StatusPill status={d.status} />
                  </div>
                  <p className="small mt-8">{d.reason}</p>
                  {d.admin_note && <p className="tiny muted mt-8">Admin: {d.admin_note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
