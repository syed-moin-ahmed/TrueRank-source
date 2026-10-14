import { useState } from "react";
import { LuClipboardList } from "react-icons/lu";
import { Card, EmptyState, ErrorState, PageHeader, SkeletonCards, StatusPill, Tabs } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { dateTime, score } from "../../utils/format.js";

export default function AdminRequests() {
  useDocumentTitle("Requests & jobs");
  const [tab, setTab] = useState("requests");
  const requests = useApi("/service-requests");
  const jobs = useApi("/jobs");
  const active = tab === "requests" ? requests : jobs;

  return (
    <>
      <PageHeader title="Requests & jobs" subtitle="Every service request and every worker selection." />
      <div className="stack" style={{ "--gap": "16px" }}>
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: "requests", label: "Service requests", count: requests.data?.items.length },
          { value: "jobs", label: "Jobs", count: jobs.data?.items.length },
        ]} />
        <Card className="card-flush">
          {active.loading && <div style={{ padding: 18 }}><SkeletonCards count={4} height={44} /></div>}
          {active.error && <div style={{ padding: 18 }}><ErrorState error={active.error} onRetry={active.reload} /></div>}
          {active.data && active.data.items.length === 0 && <EmptyState icon={LuClipboardList} title="Nothing here yet" />}
          {tab === "requests" && requests.data?.items.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>#</th><th>Request</th><th>Requester</th><th>Worker</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  {requests.data.items.map((r) => (
                    <tr key={r.id}>
                      <td className="mono tiny">{r.id}</td>
                      <td style={{ maxWidth: 380 }}>{r.query_text}</td>
                      <td>{r.requester_name}</td>
                      <td>{r.current_job ? <Link to={`/workers/${r.current_job.worker_id}`}>{r.current_job.worker_name}</Link> : <span className="muted">—</span>}</td>
                      <td><StatusPill status={r.status} /></td>
                      <td className="nowrap small">{dateTime(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "jobs" && jobs.data?.items.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>#</th><th>Worker</th><th>Requester</th><th>Request</th><th className="num">Rank / R</th><th>Status</th><th>Rating</th></tr></thead>
                <tbody>
                  {jobs.data.items.map((j) => (
                    <tr key={j.id}>
                      <td className="mono tiny">{j.id}</td>
                      <td><Link to={`/workers/${j.worker_id}`}>{j.worker_name}</Link><div className="tiny muted">{j.worker_occupation}{j.auto_accepted ? " · auto-accepted" : ""}</div></td>
                      <td>{j.requester_name}</td>
                      <td style={{ maxWidth: 300 }} className="small">{j.query_text}</td>
                      <td className="num">{j.selected_rank ? `#${j.selected_rank} · ${score(j.selected_final)}` : "—"}</td>
                      <td><StatusPill status={j.status} />{j.dispute_status && <div className="tiny" style={{ color: "var(--red)" }}>dispute {j.dispute_status}</div>}</td>
                      <td>{j.review_rating ? `${j.review_rating}★` : "—"}</td>
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
