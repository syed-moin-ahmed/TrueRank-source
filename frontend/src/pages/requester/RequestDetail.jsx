import { useState } from "react";
import {
  LuArrowRight, LuBan, LuCheck, LuCircleCheck, LuFlag, LuHourglass, LuPlay, LuSearch, LuSend, LuStar, LuTrendingUp, LuUserCheck, LuWrench,
} from "react-icons/lu";
import { ScoreRing } from "../../components/charts.jsx";
import { TrustBreakdown } from "../../components/truerank.jsx";
import { useToast } from "../../components/toast.jsx";
import {
  Alert, Avatar, Button, Card, CardHeader, ErrorState, Field, Modal, PageHeader, SkeletonCards, StarInput, Stars, StatusPill, Textarea,
} from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link } from "../../router.jsx";
import { post, put } from "../../services/api.js";
import { dateTime, score, timeAgo } from "../../utils/format.js";

const LIVE = ["pending", "accepted", "in_progress", "completed"];

function Timeline({ job }) {
  const steps = [
    { label: "Worker selected", time: job.created_at, icon: LuUserCheck },
    { label: job.auto_accepted ? "Auto-accepted" : "Accepted", time: job.accepted_at, icon: LuCheck },
    { label: "In progress", time: job.started_at, icon: LuWrench },
    { label: "Completed", time: job.completed_at, icon: LuCircleCheck },
    { label: "Rated", time: job.review_rating ? "done" : null, icon: LuStar },
  ];
  const doneCount = steps.filter((s) => s.time).length;
  return (
    <div className="timeline">
      {steps.map((s, i) => {
        const state = i < doneCount ? "done" : i === doneCount ? "current" : "";
        return (
          <div key={s.label} className={`tl-step ${state}`}>
            <span className="tl-dot"><s.icon /></span>
            <div>
              <div className="tl-label">{s.label}</div>
              <div className="tl-time">{s.time && s.time !== "done" ? dateTime(s.time) : s.time === "done" ? `${job.review_rating}★` : state === "current" ? "Next step" : ""}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Confetti() {
  const colors = ["#6C47FF", "#FF4D8D", "#00BFA6", "#FFAD1F", "#2E9BFF"];
  return Array.from({ length: 28 }, (_, i) => (
    <span key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 7) * 60}ms` }} />
  ));
}

function TrustChange({ result, workerName }) {
  const delta = result.trust_after - result.trust_before;
  return (
    <Card className="anim-scale-in" style={{ borderColor: "#ffe4b8" }}>
      <CardHeader title="Feedback loop: trust score recalculated" icon={LuTrendingUp} tone="amber" subtitle={`Stored in the database for ${workerName}. Future searches use the new value.`} />
      <div className="trust-change">
        <Confetti />
        <div className="center">
          <ScoreRing value={result.trust_before} tone="trust" size={108} asDecimal sub="Before rating" />
        </div>
        <LuArrowRight className="arrow" />
        <div className="center">
          <ScoreRing value={result.trust_after} tone="trust" size={130} asDecimal sub="After rating" />
        </div>
        <div className="stack" style={{ "--gap": "4px" }}>
          <span className="tiny strong muted">CHANGE</span>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: delta >= 0 ? "var(--green)" : "var(--red)" }}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(3)}
          </span>
        </div>
      </div>
      {result.trust && (
        <div className="mt-24">
          <TrustBreakdown trust={result.trust} />
        </div>
      )}
    </Card>
  );
}

export default function RequestDetail({ params }) {
  useDocumentTitle(`Request #${params.id}`);
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/service-requests/${params.id}`);
  const [busy, setBusy] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewResult, setReviewResult] = useState(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState(null);

  if (loading && !data) return <SkeletonCards count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const sr = data.service_request;
  const job = data.jobs.find((j) => LIVE.includes(j.status));
  const pastJobs = data.jobs.filter((j) => j !== job);

  const act = async (action, label) => {
    setBusy(action);
    try {
      await put(`/jobs/${job.id}/${action}`);
      toast.success(label);
      await reload();
    } catch (e) {
      toast.error("Action failed", e.message);
    } finally {
      setBusy(null);
    }
  };

  const submitReview = async () => {
    if (!rating) {
      setFormError("Choose a star rating.");
      return;
    }
    setFormError(null);
    setBusy("review");
    try {
      const res = await post("/reviews", { job_id: job.id, rating, comment: comment.trim() });
      setReviewResult(res);
      toast.success("Thank you for the feedback", "The worker’s trust score has been updated.");
      await reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const submitDispute = async () => {
    setBusy("dispute");
    try {
      const res = await post("/disputes", { job_id: job.id, reason: reason.trim() });
      toast.info("Dispute reported", `Trust score ${score(res.trust_before)} → ${score(res.trust_after)}. An administrator will review it.`);
      setDisputeOpen(false);
      setReason("");
      await reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const cancelRequest = async () => {
    setBusy("cancel-request");
    try {
      await put(`/service-requests/${sr.id}/cancel`);
      toast.success("Request cancelled");
      await reload();
    } catch (e) {
      toast.error("Could not cancel", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title={`Request #${sr.id}`}
        subtitle={`“${sr.query_text}”`}
        actions={
          <>
            <StatusPill status={sr.status} />
            {sr.status === "open" && (
              <>
                <Button variant="primary" icon={LuSearch} to={`/requester/find?request=${sr.id}`}>Find workers</Button>
                <Button variant="danger" icon={LuBan} loading={busy === "cancel-request"} onClick={cancelRequest}>Cancel request</Button>
              </>
            )}
          </>
        }
      />

      <div className="stack" style={{ "--gap": "22px" }}>
        {!job && sr.status === "open" && (
          <Alert type="violet" title="No worker selected yet">
            Run the TrueRank matching for this request and pick a worker from the ranked list.{" "}
            <Link to={`/requester/find?request=${sr.id}`}>Find workers →</Link>
          </Alert>
        )}

        {job && (
          <>
            <Card className="anim-fade-up">
              <div className="row-between">
                <div className="row">
                  <Avatar name={job.worker_name} size="lg" />
                  <div>
                    <h3 style={{ fontSize: "1.3rem" }}>{job.worker_name}</h3>
                    <div className="muted small">{job.worker_occupation} · {job.worker_city}</div>
                    <div className="row mt-8" style={{ "--gap": "8px" }}>
                      <StatusPill status={job.status} />
                      {job.auto_accepted && <span className="badge badge-demo">Dataset profile · auto-accepted</span>}
                      {job.dispute_status && <span className="badge badge-red"><LuFlag /> Dispute {job.dispute_status}</span>}
                    </div>
                  </div>
                </div>
                <div className="row">
                  {job.selected_final !== null && (
                    <div className="stack center" style={{ "--gap": "2px" }}>
                      <span className="tiny muted strong">WHEN SELECTED</span>
                      <span className="small mono">rank #{job.selected_rank} · R {score(job.selected_final)}</span>
                      <span className="tiny mono muted">S {score(job.selected_similarity)} · TS {score(job.selected_trust)}</span>
                    </div>
                  )}
                  <ScoreRing value={job.worker_trust_score} tone="trust" size={86} asDecimal sub="Trust now" />
                  <Button variant="soft" to={`/workers/${job.worker_id}`}>View profile</Button>
                </div>
              </div>
              <hr className="divider" />
              <Timeline job={job} />
            </Card>

            <Card className="anim-fade-up">
              <CardHeader title="Next step" icon={LuHourglass} tone="sky" />
              {job.status === "pending" && (
                <div className="row-between">
                  <p className="muted">Waiting for {job.worker_name} to accept your request.</p>
                  <Button variant="danger" icon={LuBan} loading={busy === "cancel"} onClick={() => act("cancel", "Job request cancelled")}>Cancel</Button>
                </div>
              )}
              {job.status === "accepted" && (
                <div className="row-between">
                  <p className="muted">
                    {job.auto_accepted ? "This dataset worker has no login, so you can start the job yourself." : `${job.worker_name} accepted. They will start the job.`}
                  </p>
                  <div className="row">
                    {job.auto_accepted && <Button variant="primary" icon={LuPlay} loading={busy === "start"} onClick={() => act("start", "Job started")}>Start job</Button>}
                    <Button variant="danger" icon={LuBan} loading={busy === "cancel"} onClick={() => act("cancel", "Job cancelled")}>Cancel</Button>
                  </div>
                </div>
              )}
              {job.status === "in_progress" && (
                <div className="row-between">
                  <p className="muted">The job is in progress. Mark it as completed when the work is done.</p>
                  <div className="row">
                    <Button variant="green" icon={LuCircleCheck} loading={busy === "complete"} onClick={() => act("complete", "Job marked as completed")}>Mark job as completed</Button>
                    {!job.dispute_status && <Button variant="danger" icon={LuFlag} onClick={() => setDisputeOpen(true)}>Report dispute</Button>}
                  </div>
                </div>
              )}
              {job.status === "completed" && job.review_rating && (
                <div className="row-between">
                  <div>
                    <div className="row"><Stars value={job.review_rating} size={20} /><span className="strong">You rated this job {job.review_rating}/5</span></div>
                    {job.review_comment && <p className="muted small mt-8">“{job.review_comment}”</p>}
                  </div>
                  {!job.dispute_status && <Button variant="danger" size="sm" icon={LuFlag} onClick={() => setDisputeOpen(true)}>Report dispute</Button>}
                </div>
              )}
              {job.status === "completed" && !job.review_rating && (
                <div className="stack">
                  <p className="muted">The job is complete. Rate {job.worker_name} — your rating updates their Composite Trust Score immediately.</p>
                  <StarInput value={rating} onChange={setRating} />
                  <Field label="Feedback (optional)" hint="Written feedback is also added to the worker’s profile text used by TF-IDF.">
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="What went well? Was anything missing?" style={{ minHeight: 90 }} />
                  </Field>
                  {formError && <Alert type="error">{formError}</Alert>}
                  <div className="row">
                    <Button variant="primary" icon={LuSend} loading={busy === "review"} onClick={submitReview}>Submit rating</Button>
                    {!job.dispute_status && <Button variant="danger" icon={LuFlag} onClick={() => setDisputeOpen(true)}>Report dispute</Button>}
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {reviewResult && <TrustChange result={reviewResult} workerName={job?.worker_name} />}

        {pastJobs.length > 0 && (
          <Card>
            <CardHeader title="Earlier selections for this request" icon={LuUserCheck} />
            <ul className="list-plain">
              {pastJobs.map((j) => (
                <li key={j.id} className="list-row">
                  <Avatar name={j.worker_name} size="sm" />
                  <div style={{ flex: 1 }}>
                    <div className="strong small">{j.worker_name}</div>
                    <div className="tiny muted">{j.worker_occupation} · {timeAgo(j.updated_at)}</div>
                  </div>
                  <StatusPill status={j.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Modal open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Report a dispute" subtitle="A dispute lowers the worker’s Dispute Adjustment (DA) until an administrator reviews it.">
        <div className="stack">
          <Field label="What went wrong?" hint="At least 10 characters">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </Field>
          {formError && disputeOpen && <Alert type="error">{formError}</Alert>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button variant="danger" icon={LuFlag} loading={busy === "dispute"} disabled={reason.trim().length < 10} onClick={submitDispute}>Report dispute</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
