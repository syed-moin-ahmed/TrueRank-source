import { useState } from "react";
import { LuArrowRight, LuClipboardList, LuPlus, LuSearch } from "react-icons/lu";
import { Avatar, Button, Card, EmptyState, ErrorState, PageHeader, SkeletonCards, StatusPill, Tabs } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { dateTime, score } from "../../utils/format.js";

const GROUPS = {
  active: ["open", "assigned", "in_progress"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

export default function Requests() {
  useDocumentTitle("Service requests");
  const { data, error, loading, reload } = useApi("/service-requests");
  const [tab, setTab] = useState("active");

  const items = data?.items || [];
  const counts = Object.fromEntries(Object.entries(GROUPS).map(([k, v]) => [k, items.filter((i) => v.includes(i.status)).length]));
  const shown = items.filter((i) => GROUPS[tab].includes(i.status));

  return (
    <>
      <PageHeader
        title="Service requests"
        subtitle="Track every request from search to rating."
        actions={<Button variant="primary" icon={LuPlus} to="/requester/find">New request</Button>}
      />
      <div className="stack" style={{ "--gap": "18px" }}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "active", label: "Active", count: counts.active },
            { value: "completed", label: "Completed", count: counts.completed },
            { value: "cancelled", label: "Cancelled", count: counts.cancelled },
          ]}
        />
        {loading && <SkeletonCards count={3} height={90} />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && shown.length === 0 && (
          <Card>
            <EmptyState icon={LuClipboardList} title={`No ${tab} requests`} action={tab === "active" && <Button variant="primary" icon={LuSearch} to="/requester/find">Find a worker</Button>} />
          </Card>
        )}
        <div className="stack stagger" style={{ "--gap": "12px" }}>
          {shown.map((r, i) => {
            const job = r.current_job;
            return (
              <Link key={r.id} to={`/requester/requests/${r.id}`} style={{ color: "inherit", "--i": i }}>
                <Card hover className="row-between">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row" style={{ "--gap": "10px" }}>
                      <span className="mono tiny muted">#{r.id}</span>
                      <StatusPill status={r.status} />
                      {r.city && <span className="chip gray">{r.city}</span>}
                    </div>
                    <div className="strong mt-8" style={{ fontSize: "1.02rem" }}>{r.query_text}</div>
                    <div className="tiny muted mt-8">Created {dateTime(r.created_at)}</div>
                  </div>
                  <div className="row">
                    {job ? (
                      <div className="row" style={{ "--gap": "10px" }}>
                        <Avatar name={job.worker_name} size="sm" />
                        <div>
                          <div className="small strong">{job.worker_name}</div>
                          <div className="tiny muted">
                            {job.worker_occupation}
                            {job.selected_final !== null && ` · R ${score(job.selected_final)}`}
                          </div>
                        </div>
                        <StatusPill status={job.status} />
                      </div>
                    ) : (
                      <span className="small muted">No worker selected yet</span>
                    )}
                    <LuArrowRight style={{ width: 18, height: 18, color: "var(--ink-300)" }} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
