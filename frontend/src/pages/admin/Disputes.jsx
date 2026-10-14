import { useState } from "react";
import { LuFlag, LuGavel } from "react-icons/lu";
import { useToast } from "../../components/toast.jsx";
import { Alert, Avatar, Button, Card, EmptyState, ErrorState, Field, Modal, PageHeader, SkeletonCards, StatusPill, Textarea } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { put } from "../../services/api.js";
import { dateTime, score } from "../../utils/format.js";

export default function AdminDisputes() {
  useDocumentTitle("Disputes");
  const toast = useToast();
  const { data, error, loading, reload } = useApi("/admin/disputes");
  const [active, setActive] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);

  const resolve = async (status) => {
    setBusy(status);
    try {
      const res = await put(`/admin/disputes/${active.id}`, { status, admin_note: note.trim() });
      toast.success(status === "upheld" ? "Dispute upheld" : "Dispute dismissed", `${active.worker_name}'s trust score is now ${score(res.trust_score, 3)}.`);
      setActive(null);
      setNote("");
      reload();
    } catch (e) {
      toast.error("Could not resolve", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Disputes" subtitle="Open and upheld disputes lower the worker’s Dispute Adjustment (DA). Dismissing a dispute removes its effect." />
      {loading && <SkeletonCards count={3} height={90} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.items.length === 0 && <Card><EmptyState icon={LuFlag} title="No disputes" tone="green">Nothing to review.</EmptyState></Card>}
      <div className="stack stagger" style={{ "--gap": "12px" }}>
        {data?.items.map((d, i) => (
          <Card key={d.id} style={{ "--i": i, borderColor: d.status === "open" ? "#ffd0d8" : undefined }}>
            <div className="row-between" style={{ alignItems: "flex-start" }}>
              <div className="row" style={{ alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                <Avatar name={d.worker_name} />
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ "--gap": "8px" }}>
                    <Link to={`/workers/${d.worker_id}`} className="strong">{d.worker_name}</Link>
                    <span className="tiny muted">{d.worker_occupation} · TS {score(d.worker_trust_score)}</span>
                    <StatusPill status={d.status} />
                  </div>
                  <p className="mt-8">{d.reason}</p>
                  <div className="tiny muted mt-8">Reported by {d.raised_by_name} · {dateTime(d.created_at)} · request: “{d.query_text}”</div>
                  {d.admin_note && <div className="small mt-8"><strong>Admin note:</strong> {d.admin_note}</div>}
                </div>
              </div>
              {d.status === "open" && <Button variant="soft" icon={LuGavel} onClick={() => setActive(d)}>Review</Button>}
            </div>
          </Card>
        ))}
      </div>
      <Modal open={Boolean(active)} onClose={() => setActive(null)} title="Resolve dispute" subtitle={active ? `${active.worker_name} — “${active.reason}”` : ""}>
        <div className="stack">
          <Alert type="info">Upheld: the dispute keeps counting in DA. Dismissed: it is removed and the trust score is recalculated.</Alert>
          <Field label="Note (optional)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} style={{ minHeight: 80 }} />
          </Field>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => resolve("dismissed")} loading={busy === "dismissed"}>Dismiss</Button>
            <Button variant="danger" onClick={() => resolve("upheld")} loading={busy === "upheld"}>Uphold</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
