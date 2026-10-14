import { LuMessageSquare } from "react-icons/lu";
import { BarChart } from "../../components/charts.jsx";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonCards, Stars } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { dateTime } from "../../utils/format.js";

export default function AdminReviews() {
  useDocumentTitle("Ratings & feedback");
  const { data, error, loading, reload } = useApi("/admin/reviews");
  const items = data?.items || [];
  const dist = [1, 2, 3, 4, 5].map((s) => ({ label: `${s}★`, value: items.filter((r) => r.rating === s).length }));

  return (
    <>
      <PageHeader title="Ratings & feedback" subtitle="All ratings submitted on the platform (each one triggered a trust recalculation)." />
      <div className="grid split-aside">
        <Card>
          <CardHeader title="Rating distribution" icon={LuMessageSquare} tone="amber" />
          {items.length ? <BarChart items={dist} height={200} colors={["#FFAD1F", "#FF7A45"]} /> : <p className="small muted">No ratings yet.</p>}
        </Card>
        <Card className="card-flush">
          {loading && <div style={{ padding: 18 }}><SkeletonCards count={4} height={44} /></div>}
          {error && <div style={{ padding: 18 }}><ErrorState error={error} onRetry={reload} /></div>}
          {data && items.length === 0 && <EmptyState icon={LuMessageSquare} title="No feedback yet" />}
          {items.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Worker</th><th>Requester</th><th>Rating</th><th>Feedback</th><th>Date</th></tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td><Link to={`/workers/${r.worker_id}`}>{r.worker_name}</Link><div className="tiny muted">{r.worker_occupation}</div></td>
                      <td>{r.requester_name}</td>
                      <td><Stars value={r.rating} /></td>
                      <td className="small" style={{ maxWidth: 340 }}>{r.comment || <span className="muted">—</span>}</td>
                      <td className="nowrap small">{dateTime(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
