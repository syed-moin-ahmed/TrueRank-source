import { useState } from "react";
import { LuBriefcase, LuCheck, LuInbox, LuMapPin, LuSparkles, LuX } from "react-icons/lu";
import { useToast } from "../../components/toast.jsx";
import { Avatar, Button, Card, CardHeader, EmptyState, ErrorState, IconBubble, PageHeader, SkeletonCards } from "../../components/ui.jsx";
import { Bar } from "../../components/charts.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { put } from "../../services/api.js";
import { score, timeAgo } from "../../utils/format.js";
import { NeedsProfile } from "./Dashboard.jsx";

export default function WorkerRequests() {
  useDocumentTitle("Requests");
  const toast = useToast();
  const pending = useApi("/jobs", { status: "pending" });
  const opps = useApi("/workers/me/opportunities");
  const [busy, setBusy] = useState(null);

  if (opps.data?.needs_profile) return <NeedsProfile />;

  const act = async (job, action) => {
    setBusy(`${job.id}-${action}`);
    try {
      await put(`/jobs/${job.id}/${action}`);
      toast.success(action === "accept" ? "Job accepted" : "Request declined", action === "accept" ? "Find it under My jobs." : undefined);
      pending.reload();
    } catch (e) {
      toast.error("Action failed", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Requests" subtitle="Job requests from requesters who selected you, and open requests that match your skills." />
      <div className="grid split-even">
        <Card>
          <CardHeader title="Waiting for your answer" icon={LuInbox} tone="sky" />
          {pending.loading && <SkeletonCards count={2} height={110} />}
          {pending.error && <ErrorState error={pending.error} onRetry={pending.reload} />}
          {pending.data && pending.data.items.length === 0 && (
            <EmptyState icon={LuInbox} title="No pending requests">When a requester selects you from the ranked list, the request appears here.</EmptyState>
          )}
          <div className="stack stagger" style={{ "--gap": "14px" }}>
            {pending.data?.items.map((j, i) => (
              <div key={j.id} className="card" style={{ padding: 18, background: "var(--surface-2)", "--i": i }}>
                <div className="row" style={{ alignItems: "flex-start" }}>
                  <Avatar name={j.requester_name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="strong">{j.requester_name}</div>
                    <div className="tiny muted">{timeAgo(j.created_at)} {j.request_city && `· ${j.request_city}`}</div>
                    <p className="mt-8">“{j.query_text}”</p>
                    {j.selected_rank && (
                      <p className="tiny muted mt-8">
                        You were ranked <strong>#{j.selected_rank}</strong> (R = {score(j.selected_final)}, S = {score(j.selected_similarity)}, TS = {score(j.selected_trust)})
                      </p>
                    )}
                  </div>
                </div>
                <div className="row mt-16" style={{ justifyContent: "flex-end" }}>
                  <Button variant="danger" size="sm" icon={LuX} loading={busy === `${j.id}-reject`} onClick={() => act(j, "reject")}>Decline</Button>
                  <Button variant="green" size="sm" icon={LuCheck} loading={busy === `${j.id}-accept`} onClick={() => act(j, "accept")}>Accept</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recommended opportunities" icon={LuSparkles} tone="teal" subtitle="Open requests compared with your profile using the same TF-IDF + cosine similarity" />
          {opps.loading && <SkeletonCards count={3} height={70} />}
          {opps.data && opps.data.items.length === 0 && (
            <EmptyState icon={LuBriefcase} title="Nothing matching right now">Open requests with similarity ≥ {opps.data.threshold} to your profile will appear here.</EmptyState>
          )}
          <div className="stack stagger" style={{ "--gap": "10px" }}>
            {opps.data?.items.map((o, i) => (
              <div key={o.id} className="list-row" style={{ "--i": i }}>
                <IconBubble icon={LuBriefcase} tone="teal" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong">{o.query_text}</div>
                  <div className="tiny muted row" style={{ "--gap": "6px" }}>
                    <LuMapPin style={{ width: 12, height: 12 }} /> {o.city || "Any city"} {o.same_city && <span className="chip green" style={{ padding: "1px 8px" }}>your city</span>} · {o.requester_name} · {timeAgo(o.created_at)}
                  </div>
                  <div className="mt-8" style={{ maxWidth: 260 }}><Bar value={o.similarity_score} tone="sim" thin /></div>
                </div>
                <span className="mono small strong text-sim">{score(o.similarity_score)}</span>
              </div>
            ))}
          </div>
          {opps.data?.items.length > 0 && <p className="tiny muted mt-16">Requesters choose workers from their ranked list. A strong, detailed profile and a good trust score improve your chance of being selected.</p>}
        </Card>
      </div>
    </>
  );
}
