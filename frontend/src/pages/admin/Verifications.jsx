import { LuBadgeCheck, LuCheck, LuX } from "react-icons/lu";
import { useToast } from "../../components/toast.jsx";
import { Avatar, Button, Card, EmptyState, ErrorState, PageHeader, SkeletonCards, StatusPill } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { put } from "../../services/api.js";
import { dateTime } from "../../utils/format.js";

export default function AdminVerifications() {
  useDocumentTitle("Verifications");
  const toast = useToast();
  const { data, error, loading, reload } = useApi("/admin/verifications");

  const review = async (v, status) => {
    try {
      await put(`/admin/verifications/${v.id}`, { status });
      toast.success(status === "verified" ? "Worker verified" : "Request rejected", v.worker_name);
      reload();
    } catch (e) {
      toast.error("Could not update", e.message);
    }
  };

  return (
    <>
      <PageHeader title="Verification requests" subtitle="Verification adds a badge for requesters. It is optional for workers and not part of the trust formula." />
      {loading && <SkeletonCards count={3} height={80} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.items.length === 0 && <Card><EmptyState icon={LuBadgeCheck} title="No verification requests" /></Card>}
      <div className="stack stagger" style={{ "--gap": "12px" }}>
        {data?.items.map((v, i) => (
          <Card key={v.id} style={{ "--i": i }}>
            <div className="row-between">
              <div className="row">
                <Avatar name={v.worker_name} />
                <div>
                  <Link to={`/workers/${v.worker_id}`} className="strong">{v.worker_name}</Link>
                  <div className="tiny muted">{v.worker_occupation} · {v.worker_city} · {dateTime(v.created_at)}</div>
                  <div className="small mt-8"><span className="chip sky">{v.method.replace(/_/g, " ")}</span> {v.reference_note && <span className="muted">“{v.reference_note}”</span>}</div>
                </div>
              </div>
              {v.status === "pending" ? (
                <div className="row">
                  <Button variant="danger" size="sm" icon={LuX} onClick={() => review(v, "rejected")}>Reject</Button>
                  <Button variant="green" size="sm" icon={LuCheck} onClick={() => review(v, "verified")}>Verify</Button>
                </div>
              ) : (
                <StatusPill status={v.status} />
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
