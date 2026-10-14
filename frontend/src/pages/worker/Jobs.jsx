import { useState } from "react";
import { LuBriefcase, LuLogOut, LuPhone, LuPlay } from "react-icons/lu";
import { useToast } from "../../components/toast.jsx";
import { Avatar, Button, Card, EmptyState, ErrorState, Modal, PageHeader, SkeletonCards, Stars, StatusPill, Tabs } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { put } from "../../services/api.js";
import { dateTime } from "../../utils/format.js";

const ACTIVE = ["accepted", "in_progress"];
const HISTORY = ["completed", "rejected", "withdrawn", "cancelled"];

export default function WorkerJobs() {
  useDocumentTitle("My jobs");
  const toast = useToast();
  const { data, error, loading, reload } = useApi("/jobs");
  const [tab, setTab] = useState("active");
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const items = data?.items || [];
  const active = items.filter((j) => ACTIVE.includes(j.status));
  const history = items.filter((j) => HISTORY.includes(j.status));
  const shown = tab === "active" ? active : history;

  const act = async (job, action, label) => {
    setBusy(`${job.id}-${action}`);
    try {
      await put(`/jobs/${job.id}/${action}`);
      toast.success(label);
      setConfirm(null);
      reload();
    } catch (e) {
      toast.error("Action failed", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="My jobs" subtitle="Start accepted jobs and keep track of your work history." />
      <div className="stack" style={{ "--gap": "18px" }}>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: "active", label: "Active", count: active.length }, { value: "history", label: "History", count: history.length }]} />
        {loading && <SkeletonCards count={3} height={100} />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && shown.length === 0 && (
          <Card><EmptyState icon={LuBriefcase} title={tab === "active" ? "No active jobs" : "No past jobs yet"}>Accepted requests appear here.</EmptyState></Card>
        )}
        <div className="stack stagger" style={{ "--gap": "12px" }}>
          {shown.map((j, i) => (
            <Card key={j.id} hover style={{ "--i": i }}>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div className="row" style={{ alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                  <Avatar name={j.requester_name} />
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ "--gap": "8px" }}>
                      <span className="strong">{j.requester_name}</span>
                      <StatusPill status={j.status} />
                    </div>
                    <p className="mt-8">“{j.query_text}”</p>
                    <div className="tiny muted mt-8">
                      Requested {dateTime(j.created_at)}
                      {j.completed_at && ` · completed ${dateTime(j.completed_at)}`}
                    </div>
                    {j.requester_phone && ACTIVE.includes(j.status) && (
                      <div className="small mt-8 row" style={{ "--gap": "6px" }}><LuPhone style={{ width: 14 }} /> {j.requester_phone}</div>
                    )}
                    {j.review_rating && (
                      <div className="mt-8 row" style={{ "--gap": "8px" }}>
                        <Stars value={j.review_rating} />
                        {j.review_comment && <span className="small muted">“{j.review_comment}”</span>}
                      </div>
                    )}
                    {j.dispute_status && <span className="badge badge-red mt-8">Dispute {j.dispute_status}</span>}
                  </div>
                </div>
                <div className="row">
                  {j.status === "accepted" && <Button variant="primary" size="sm" icon={LuPlay} loading={busy === `${j.id}-start`} onClick={() => act(j, "start", "Job started")}>Start job</Button>}
                  {ACTIVE.includes(j.status) && <Button variant="danger" size="sm" icon={LuLogOut} onClick={() => setConfirm(j)}>Withdraw</Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Withdraw from this job?" subtitle="Withdrawing after accepting counts as an unfinished job and lowers your Completion Rate (CR).">
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={() => setConfirm(null)}>Keep the job</Button>
          <Button variant="danger" icon={LuLogOut} loading={confirm && busy === `${confirm.id}-withdraw`} onClick={() => act(confirm, "withdraw", "You withdrew from the job")}>Withdraw</Button>
        </div>
      </Modal>
    </>
  );
}
