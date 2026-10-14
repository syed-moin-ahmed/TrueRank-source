import { useEffect, useRef, useState } from "react";
import {
  LuCalculator, LuCircleCheck, LuFileText, LuGrid3X3, LuListOrdered, LuMapPin, LuMessageSquare, LuMicroscope, LuSearch,
  LuShieldCheck, LuSparkles, LuUsers, LuSearchX,
} from "react-icons/lu";
import { RankFormula, RecommendationCard } from "../../components/truerank.jsx";
import { useToast } from "../../components/toast.jsx";
import { Alert, Button, Card, CardHeader, EmptyState, Field, PageHeader, Select, Textarea, Toggle } from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { Link, useQuery, useRouter } from "../../router.jsx";
import { get, post } from "../../services/api.js";
import { StatusPill } from "../../components/ui.jsx";

const EXAMPLES = [
  "I need an electrician to repair damaged wiring and a circuit breaker.",
  "Bathroom pipe is leaking and the sink drain is blocked",
  "Install CCTV cameras in my shop with mobile view",
  "Deep cleaning of a 2BHK flat including kitchen and sofa",
  "Split AC is not cooling, needs gas refilling and service",
  "Birthday party balloon and flower decoration",
];

const RUN_STEPS = [
  { label: "User query", icon: LuMessageSquare },
  { label: "Preprocessing", icon: LuFileText },
  { label: "TF-IDF", icon: LuGrid3X3 },
  { label: "Cosine similarity", icon: LuCalculator },
  { label: "Trust score", icon: LuShieldCheck },
  { label: "Ranking", icon: LuListOrdered },
  { label: "Recommendations", icon: LuUsers },
];

function stepValues(result) {
  if (!result) return [];
  const p = result.pipeline;
  const w = p.trust_weights;
  return [
    `${result.query.length} characters`,
    `${result.processing.terms.length} terms kept`,
    `${p.vocabulary_size} terms × ${p.documents_indexed} profiles`,
    `${p.candidates_above_threshold} with S ≥ ${p.min_similarity}`,
    `${w.AR}/${w.CR}/${w.PE}/${w.DA}`,
    `λ = ${p.lambda.toFixed(2)}`,
    `${result.results.length} shown`,
  ];
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function FindWorkers() {
  useDocumentTitle("Find workers");
  const toast = useToast();
  const { navigate } = useRouter();
  const params = useQuery();
  const filters = useApi("/workers/filters");

  const [requestId, setRequestId] = useState(params.request ? Number(params.request) : null);
  const [requestStatus, setRequestStatus] = useState(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [topN, setTopN] = useState(10);
  const [phase, setPhase] = useState("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [selecting, setSelecting] = useState(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (!params.request) return;
    get(`/service-requests/${params.request}`)
      .then((d) => {
        setQuery(d.service_request.query_text);
        setCity(d.service_request.city || "");
        setRequestStatus(d.service_request.status);
      })
      .catch((e) => setError(e.message));
  }, [params.request]);

  const run = async (e) => {
    e?.preventDefault();
    const text = query.trim();
    if (text.length < 5) {
      setFieldError("Describe the job in at least a few words.");
      return;
    }
    setFieldError(null);
    setError(null);
    setResult(null);
    setPhase("running");
    setActiveStep(0);

    let stepTimer;
    let current = 0;
    const tick = () => {
      current = Math.min(current + 1, 5);
      setActiveStep(current);
      stepTimer = setTimeout(tick, 320);
    };
    stepTimer = setTimeout(tick, 320);

    try {
      let srId = requestId;
      if (!srId || requestStatus !== "open") {
        const created = await post("/service-requests", { query_text: text, city: city || null });
        srId = created.service_request.id;
        setRequestId(srId);
        setRequestStatus("open");
        window.history.replaceState(null, "", `/requester/find?request=${srId}`);
      }
      const data = await post("/match", {
        query: text,
        city: city || null,
        verified_only: verifiedOnly,
        top_n: Number(topN),
        service_request_id: srId,
      });
      clearTimeout(stepTimer);
      for (let i = current + 1; i <= 7; i += 1) {
        setActiveStep(i);
        await wait(140);
      }
      setResult(data);
      setPhase("done");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (err) {
      clearTimeout(stepTimer);
      setPhase("idle");
      setActiveStep(-1);
      if (err.fields?.query) setFieldError(err.fields.query);
      setError(err.message);
    }
  };

  const select = async (worker) => {
    setSelecting(worker.worker_id);
    try {
      await post("/jobs", { service_request_id: requestId, worker_id: worker.worker_id, match_log_id: result.match_log_id });
      toast.success(
        `${worker.name} selected`,
        worker.has_account ? "The worker has been notified and can accept your request." : "Dataset profile — the job was auto-accepted."
      );
      navigate(`/requester/requests/${requestId}`);
    } catch (err) {
      toast.error("Could not select worker", err.message);
      setSelecting(null);
    }
  };

  const values = stepValues(result);
  const lambda = result?.pipeline.lambda ?? 0.7;
  const locked = requestStatus && requestStatus !== "open";

  return (
    <>
      <PageHeader
        title="Find skilled workers"
        subtitle="Describe the job in your own words. TrueRank runs the full NLP pipeline and ranks workers by skill similarity and trust."
        eyebrow={<><LuSparkles /> TrueRank matching</>}
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr)", "--gap": "22px" }}>
        <Card className="anim-fade-up">
          <form className="composer" onSubmit={run}>
            {requestId && (
              <div className="row small">
                <span className="muted">Service request #{requestId}</span>
                {requestStatus && <StatusPill status={requestStatus} />}
                {locked && (
                  <span className="muted">
                    — a worker is already selected. <Link to={`/requester/requests/${requestId}`}>Open request</Link> or edit the text to start a new one.
                  </span>
                )}
              </div>
            )}
            <Field label="What do you need done?" error={fieldError} hint="Press Enter or click Find workers to search. The examples below are only shortcuts.">
              <Textarea
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  // Editing the text makes it a new request (the old one keeps its original wording).
                  if (requestId) {
                    setRequestId(null);
                    setRequestStatus(null);
                  }
                }}
                onKeyDown={(e) => {
                  // Enter searches straight away (Shift+Enter still adds a new line).
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (phase !== "running") run();
                  }
                }}
                placeholder="Type any job in your own words and press Enter — e.g. my kitchen tap is leaking"
                maxLength={600}
                error={fieldError}
              />
            </Field>
            <div className="examples">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="chip clickable sky"
                  onClick={() => {
                    setQuery(ex);
                    setRequestId(null);
                    setRequestStatus(null);
                  }}
                >
                  {ex.length > 42 ? `${ex.slice(0, 42)}…` : ex}
                </button>
              ))}
            </div>
            <div className="composer-bar">
              <div style={{ minWidth: 180 }}>
                <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
                  <option value="">All cities</option>
                  {filters.data?.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div style={{ width: 130 }}>
                <Select value={topN} onChange={(e) => setTopN(e.target.value)} aria-label="Number of results">
                  {[5, 10, 20].map((n) => <option key={n} value={n}>Top {n}</option>)}
                </Select>
              </div>
              <Toggle checked={verifiedOnly} onChange={setVerifiedOnly} label="Verified only" />
              <Button type="submit" variant="primary" size="lg" icon={LuSearch} loading={phase === "running"} style={{ marginLeft: "auto" }}>
                Find workers
              </Button>
            </div>
          </form>
        </Card>

        {error && <Alert type="error">{error}</Alert>}

        {phase !== "idle" && (
          <Card className="anim-fade-up">
            <CardHeader title="TrueRank pipeline" icon={LuMicroscope} subtitle={phase === "running" ? "Running on the server…" : "Completed — values below come from the backend response."} />
            <div className="pipeline-run">
              {RUN_STEPS.map((s, i) => {
                const state = activeStep > i || phase === "done" ? "done" : activeStep === i ? "active" : "";
                return (
                  <div key={s.label} className={`run-step ${state}`}>
                    <span className="icon-bubble">{state === "done" ? <LuCircleCheck /> : <s.icon />}</span>
                    <span className="run-label">{s.label}</span>
                    <span className="run-value">{phase === "done" ? values[i] : state === "active" ? "…" : ""}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {result && (
          <div ref={resultsRef} className="stack" style={{ "--gap": "22px", scrollMarginTop: 90 }}>
            <Card className="anim-fade-up">
              <CardHeader title="Pipeline inspector" icon={LuSparkles} tone="teal" subtitle="What the backend actually computed for this query" />
              <div className="inspector">
                <div>
                  <h4>Tokens after cleaning</h4>
                  <div className="tag-row">{result.processing.tokens.map((t, i) => <span key={i} className="chip gray">{t}</span>)}</div>
                </div>
                <div>
                  <h4>Removed stop words</h4>
                  <div className="tag-row">
                    {result.processing.removed_stop_words.length ? result.processing.removed_stop_words.map((t, i) => <span key={i} className="chip red strike">{t}</span>) : <span className="small muted">none</span>}
                  </div>
                </div>
                <div>
                  <h4>Terms used for TF-IDF</h4>
                  <div className="tag-row">
                    {result.processing.known_terms.map((t) => <span key={t} className="chip teal">{t}</span>)}
                    {result.processing.unknown_terms.map((t) => <span key={t} className="chip outline" title="Not in any worker profile, so it cannot affect similarity">{t} · unseen</span>)}
                  </div>
                  {result.processing.expansions?.length > 0 && (
                    <div className="tag-row mt-8">
                      {result.processing.expansions.map((x) => (
                        <span key={x.term} className="chip violet" title="Everyday word expanded to the words worker profiles use">
                          {x.term} → {x.added.join(", ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4>Ranking</h4>
                  <RankFormula lambda={lambda} />
                  <p className="tiny muted mt-8">
                    {result.pipeline.documents_indexed} profiles indexed · {result.pipeline.candidates_considered} matched the filters ·{" "}
                    {result.pipeline.candidates_above_threshold} had similarity ≥ τ = {result.pipeline.min_similarity}
                  </p>
                </div>
              </div>
            </Card>

            <div className="row-between">
              <h2 style={{ fontSize: "1.45rem" }}>
                {result.results.length ? `Top ${result.results.length} recommended workers` : "No matching workers"}
              </h2>
              <div className="legend">
                <span><i style={{ background: "var(--grad-brand)" }} /> TrueRank R(w,q)</span>
                <span><i style={{ background: "var(--grad-sim)" }} /> Skill similarity S(w,q)</span>
                <span><i style={{ background: "var(--grad-trust)" }} /> Trust TS(w)</span>
              </div>
            </div>

            {result.results.length === 0 ? (
              <Card>
                <EmptyState icon={LuSearchX} title="No worker profile shares enough words with this request" tone="amber">
                  Try describing the trade (e.g. “plumber”, “electrician”) or specific tasks. Words marked “unseen” above do not appear in any profile.
                </EmptyState>
              </Card>
            ) : (
              <div className="stack" style={{ "--gap": "18px" }}>
                {result.results.map((r, i) => (
                  <RecommendationCard
                    key={r.worker_id}
                    result={r}
                    lambda={lambda}
                    selectable={requestStatus === "open"}
                    selecting={selecting === r.worker_id}
                    onSelect={select}
                    profileHref={`/workers/${r.worker_id}?request=${requestId}&log=${result.match_log_id}`}
                    style={{ animation: `fadeUp .6s var(--ease) both`, animationDelay: `${Math.min(i, 8) * 90}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {phase === "idle" && !result && (
          <Card>
            <EmptyState icon={LuMapPin} title="Ready when you are" tone="sky">
              Type a request above or pick an example. Results show the real skill similarity, trust score and TrueRank score for each worker.
            </EmptyState>
          </Card>
        )}
      </div>
    </>
  );
}
