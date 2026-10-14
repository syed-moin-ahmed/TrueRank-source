import { useEffect, useState } from "react";
import {
  LuArrowLeft, LuBriefcase, LuHandshake, LuHistory, LuLanguages, LuMapPin, LuMessageSquare, LuQuote, LuShieldCheck, LuSparkles, LuUserCheck,
} from "react-icons/lu";
import { LineChart, ScoreRing } from "../../components/charts.jsx";
import { MetricStrip, TrustBreakdown, TrustFormula } from "../../components/truerank.jsx";
import { useToast } from "../../components/toast.jsx";
import {
  Avatar, Button, Card, CardHeader, EmptyState, ErrorState, Field, Modal, SkeletonCards, SourceBadge, Stars, Textarea, VerifiedBadge,
} from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { useQuery, useRouter } from "../../router.jsx";
import { get, post } from "../../services/api.js";
import { useAuth } from "../../services/auth.jsx";
import { date, timeAgo, TRIGGER_LABEL, years } from "../../utils/format.js";
import OccupationIcon from "../../components/OccupationIcon.jsx";

export default function WorkerDetail({ params }) {
  const { user } = useAuth();
  const toast = useToast();
  const { navigate } = useRouter();
  const q = useQuery();
  const { data, error, loading, reload } = useApi(`/workers/${params.id}`);
  const history = useApi(`/workers/${params.id}/trust-history`);
  // When the profile is opened from a search result, load the exact scores from that search.
  const [fromSearch, setFromSearch] = useState(null);
  useEffect(() => {
    if (!q.log || !["requester", "admin"].includes(user.role)) return;
    get(`/match/${q.log}/workers/${params.id}`).then(setFromSearch).catch(() => setFromSearch(null));
  }, [q.log, params.id, user.role]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [endorseOpen, setEndorseOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const w = data?.worker;
  useDocumentTitle(w ? w.name : "Worker");

  useEffect(() => {
    if (user.role !== "requester" || !q.request) return;
    get(`/service-requests/${q.request}`)
      .then((d) => setRequestOpen(d.service_request.status === "open"))
      .catch(() => setRequestOpen(false));
  }, [q.request, user.role]);

  if (loading && !data) return <SkeletonCards count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const select = async () => {
    setSelecting(true);
    try {
      await post("/jobs", { service_request_id: Number(q.request), worker_id: w.id, match_log_id: q.log ? Number(q.log) : null });
      toast.success(`${w.name} selected`);
      navigate(`/requester/requests/${q.request}`);
    } catch (e) {
      toast.error("Could not select worker", e.message);
      setSelecting(false);
    }
  };

  const endorse = async () => {
    setBusy(true);
    try {
      const res = await post(`/workers/${w.id}/endorse`, { note: note.trim() });
      toast.success("Endorsement added", `${w.name}'s trust score is now ${res.trust_score.toFixed(3)}.`);
      setEndorseOpen(false);
      await Promise.all([reload(), history.reload()]);
    } catch (e) {
      toast.error("Could not endorse", e.message);
    } finally {
      setBusy(false);
    }
  };

  const points = (history.data?.items || []).map((h, i) => ({ label: i === 0 ? "start" : `#${i + 1}`, value: h.trust_score, note: TRIGGER_LABEL[h.trigger] || h.trigger }));

  return (
    <div className="stack" style={{ "--gap": "22px" }}>
      <div>
        <Button variant="ghost" size="sm" icon={LuArrowLeft} onClick={() => window.history.back()}>Back</Button>
      </div>

      <Card className="profile-hero anim-fade-up">
        <Avatar name={w.name} gender={w.gender} size="xl" />
        <div className="stack" style={{ "--gap": "10px" }}>
          <div className="row" style={{ "--gap": "8px" }}>
            <VerifiedBadge verified={w.is_verified} />
            <SourceBadge source={w.source} label={w.source_label} />
            {!w.is_available && <span className="badge badge-red">Unavailable</span>}
          </div>
          <h1>{w.name}</h1>
          <div className="rec-meta">
            <span><OccupationIcon occupation={w.occupation} /> {w.occupation}</span>
            <span><LuMapPin /> {w.city}</span>
            {w.languages.length > 0 && <span><LuLanguages /> {w.languages.join(", ")}</span>}
            <span>{years(w.experience_years)} experience</span>
          </div>
        </div>
        <div className="row">
          <ScoreRing value={w.trust_score} tone="trust" size={120} stroke={11} sub="Trust score" label="Trust score TS(w)" />
          <div className="stack" style={{ "--gap": "8px" }}>
            {requestOpen && <Button variant="primary" icon={LuUserCheck} loading={selecting} onClick={select}>Select worker</Button>}
            {data.worker.can_endorse && <Button variant="amber" icon={LuHandshake} onClick={() => setEndorseOpen(true)}>Endorse</Button>}
          </div>
        </div>
      </Card>

      {fromSearch && (
        <Card className="search-scores anim-fade-up">
          <CardHeader
            title={`Rank #${fromSearch.rank} in your search`}
            icon={LuSparkles}
            subtitle={`“${fromSearch.query_text}” — the same scores shown on the result card`}
          />
          <div className="search-scores-row">
            <ScoreRing value={fromSearch.final_score} tone="rank" size={96} sub="TrueRank" label="TrueRank score R(w,q)" />
            <span className="ss-op">=</span>
            <div className="ss-term">
              <span className="ss-w">{fromSearch.lambda.toFixed(2)} ×</span>
              <ScoreRing value={fromSearch.similarity_score} tone="sim" size={78} stroke={8} sub="Skill" label="Skill similarity S(w,q)" />
            </div>
            <span className="ss-op">+</span>
            <div className="ss-term">
              <span className="ss-w">{(1 - fromSearch.lambda).toFixed(2)} ×</span>
              <ScoreRing value={fromSearch.trust_score} tone="trust" size={78} stroke={8} sub="Trust" label="Trust score TS(w)" />
            </div>
          </div>
          {Math.abs(fromSearch.trust_score - w.trust_score) > 0.0005 && (
            <p className="small muted mt-16">
              Trust has changed since this search ({(fromSearch.trust_score * 100).toFixed(0)}% → {(w.trust_score * 100).toFixed(0)}%) because new feedback was recorded. Run the search again to rank with the updated score.
            </p>
          )}
        </Card>
      )}

      <MetricStrip metrics={w.metrics} experience={w.experience_years} />

      <div className="grid split-main">
        <div className="stack" style={{ "--gap": "22px" }}>
          <Card className="anim-fade-up">
            <CardHeader title="In their own words" icon={LuQuote} tone="pink" />
            <p style={{ color: "var(--ink-700)" }}>{w.profile_description || <span className="muted">No description.</span>}</p>
            <div className="tag-row mt-16">
              {w.skills.map((s) => <span className="chip" key={s}>{s}</span>)}
            </div>
          </Card>

          <Card className="anim-fade-up">
            <CardHeader title="Work history" icon={LuHistory} tone="sky" />
            {w.work_history.length === 0 ? (
              <p className="small muted">No work history entries.</p>
            ) : (
              w.work_history.map((h) => (
                <div className="history-item" key={h.id}>
                  <span className="hdot" />
                  <div>
                    <div className="strong">{h.title} {h.year && <span className="muted small">· {h.year}</span>}</div>
                    {h.description && <p className="small muted">{h.description}</p>}
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card className="anim-fade-up">
            <CardHeader title="Customer feedback" icon={LuMessageSquare} tone="green" />
            {w.base_review_text && (
              <div className="list-row" style={{ alignItems: "flex-start" }}>
                <span className="badge badge-demo">Dataset</span>
                <div>
                  <p className="small">“{w.base_review_text}”</p>
                  {w.base_review_sentiment && <span className="tiny muted">Review sentiment (from dataset): {w.base_review_sentiment}</span>}
                </div>
              </div>
            )}
            {data.worker.reviews.length === 0 && !w.base_review_text && <EmptyState icon={LuMessageSquare} title="No feedback yet" />}
            {data.worker.reviews.map((r, i) => (
              <div className="list-row" key={i} style={{ alignItems: "flex-start" }}>
                <Avatar name={r.requester_name} size="sm" />
                <div style={{ flex: 1 }}>
                  <div className="row-between">
                    <span className="strong small">{r.requester_name}</span>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="small mt-8">“{r.comment}”</p>}
                  <span className="tiny muted">{timeAgo(r.created_at)}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div className="stack" style={{ "--gap": "22px" }}>
          <Card className="anim-fade-up">
            <CardHeader title="Composite Trust Score" icon={LuShieldCheck} tone="amber" subtitle={`Last updated ${w.trust.updated_at ? timeAgo(w.trust.updated_at) : "—"}`} />
            <div className="stack">
              <TrustFormula weights={Object.fromEntries(w.trust.components.map((c) => [c.key, c.weight]))} />
              <TrustBreakdown trust={w.trust} compact />
              <div className="row-between strong" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                <span>TS(w)</span>
                <span className="mono" style={{ fontSize: "1.2rem", color: "var(--amber-600)" }}>{w.trust.score.toFixed(3)}</span>
              </div>
            </div>
          </Card>

          <Card className="anim-fade-up">
            <CardHeader title="Trust history" icon={LuSparkles} subtitle="Every recalculation stored in trust_snapshots" />
            {points.length > 1 ? (
              <LineChart points={points} height={200} color={["#FFAD1F", "#FF4D8D"]} />
            ) : (
              <p className="small muted">Only the initial score so far ({points[0]?.note || "—"}). New ratings, jobs, endorsements and disputes will appear here.</p>
            )}
          </Card>

          <Card className="anim-fade-up">
            <CardHeader title="Peer endorsements" icon={LuHandshake} tone="teal" subtitle={`${w.metrics.endorsements} in total (including dataset baseline)`} />
            {data.worker.endorsements.length === 0 ? (
              <p className="small muted">No endorsements recorded on this platform yet.</p>
            ) : (
              data.worker.endorsements.map((e, i) => (
                <div className="list-row" key={i} style={{ alignItems: "flex-start" }}>
                  <Avatar name={e.endorser_name} size="sm" />
                  <div>
                    <div className="small strong">{e.endorser_name} <span className="muted">· {e.endorser_occupation}</span></div>
                    {e.note && <p className="small">“{e.note}”</p>}
                    <span className="tiny muted">{date(e.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      <Modal open={endorseOpen} onClose={() => setEndorseOpen(false)} title={`Endorse ${w.name}`} subtitle="Peer endorsements (PE) carry 20% of the Composite Trust Score. Endorse only workers whose work you know.">
        <div className="stack">
          <Field label="Note (optional)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Worked with him on a site — very careful with wiring." style={{ minHeight: 80 }} />
          </Field>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setEndorseOpen(false)}>Cancel</Button>
            <Button variant="amber" icon={LuHandshake} loading={busy} onClick={endorse}>Endorse</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
