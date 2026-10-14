// Components specific to the TrueRank method: trust breakdown, recommendation card, formulas.
import {
  LuBriefcase, LuCircleCheck, LuEye, LuInfo, LuLanguages, LuMapPin, LuSparkles, LuStar, LuTriangleAlert, LuUserCheck,
} from "react-icons/lu";
import { Link } from "../router.jsx";
import { pct, rating, score, years } from "../utils/format.js";
import { Bar, Composition, ScoreRing } from "./charts.jsx";
import { Avatar, Button, SourceBadge, VerifiedBadge } from "./ui.jsx";
import OccupationIcon from "./OccupationIcon.jsx";

const COMPONENT_HELP = {
  AR: "average star rating ÷ 5",
  CR: "completed ÷ accepted jobs",
  PE: "endorsements ÷ cap",
  DA: "1 − dispute rate",
};

export function TrustFormula({ weights }) {
  const w = weights || { AR: 0.4, CR: 0.2, PE: 0.2, DA: 0.2 };
  return (
    <div className="formula">
      <span className="f-trust">TS</span> <span className="f-dim">=</span> {w.AR.toFixed(2)}·AR <span className="f-dim">+</span> {w.CR.toFixed(2)}·CR{" "}
      <span className="f-dim">+</span> {w.PE.toFixed(2)}·PE <span className="f-dim">+</span> {w.DA.toFixed(2)}·DA
    </div>
  );
}

export function RankFormula({ lambda = 0.7 }) {
  return (
    <div className="formula">
      <span className="f-rank">R(w,q)</span> <span className="f-dim">=</span> {lambda.toFixed(2)}·<span className="f-sim">S(w,q)</span>{" "}
      <span className="f-dim">+</span> {(1 - lambda).toFixed(2)}·<span className="f-trust">TS(w)</span>
    </div>
  );
}

/** Trust breakdown from the API ("components" array). Missing data is shown honestly. */
export function TrustBreakdown({ trust, compact = false }) {
  if (!trust) return null;
  return (
    <div className="trust-breakdown">
      {trust.components.map((c) => (
        <div className="tb-row" key={c.key}>
          <div className="tb-name">
            {c.label}
            <small>
              {c.key} · weight {c.weight.toFixed(2)}
              {!compact && ` · ${COMPONENT_HELP[c.key]}`}
            </small>
          </div>
          <Bar value={c.value} tone="trust" />
          <div className="tb-val" title={c.has_data ? c.value.toFixed(4) : `Neutral ${c.used_value} used`}>
            {c.has_data ? pct(c.value) : <span className="tiny muted">No data</span>}
          </div>
          <div className="tb-evidence">
            {c.has_data ? c.evidence : `Not enough data — ${c.evidence.toLowerCase()} (neutral ${c.used_value.toFixed(2)} used in TS)`}
            {!compact && (
              <span className="mono" style={{ marginLeft: 8, color: "var(--ink-400)" }}>
                → contributes {c.weighted.toFixed(3)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MetricStrip({ metrics, experience }) {
  const items = [
    { label: "Experience", value: years(experience) },
    { label: "Rating", value: metrics.average_rating === null ? null : `${rating(metrics.average_rating)} / 5`, icon: true },
    { label: "Completion", value: metrics.completion_rate === null ? null : pct(metrics.completion_rate) },
    { label: "Jobs done", value: metrics.jobs_completed?.toLocaleString() },
  ];
  return (
    <div className="metric-strip">
      {items.map((m) => (
        <div className="metric" key={m.label}>
          <div className="m-label">{m.label}</div>
          {m.value === null || m.value === undefined ? (
            <div className="m-value nodata">Not enough data</div>
          ) : (
            <div className="m-value">
              {m.icon && <LuStar style={{ width: 14, height: 14, display: "inline", color: "var(--amber)", fill: "var(--amber)", marginRight: 4, verticalAlign: -2 }} />}
              {m.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const REASON_ICON = { positive: LuCircleCheck, neutral: LuInfo, caution: LuTriangleAlert };

export function Reasons({ explanation }) {
  return (
    <div className="why">
      <div className="why-title">
        <LuSparkles /> Why recommended?
      </div>
      <p className="small" style={{ marginBottom: 8, color: "var(--ink-700)" }}>{explanation.summary}</p>
      {explanation.reasons.map((r, i) => {
        const Icon = REASON_ICON[r.kind] || LuInfo;
        return (
          <div className={`reason ${r.kind}`} key={i}>
            <Icon />
            <span>{r.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/** One ranked worker returned by POST /api/match */
export function RecommendationCard({ result, lambda, onSelect, selecting, selectable = true, profileHref, style }) {
  const rankClass = result.rank <= 3 ? `rank-${result.rank}` : "";
  return (
    <article className={`card rec-card ${result.rank === 1 ? "top-1" : ""}`} style={style}>
      <div className={`rank-badge ${rankClass}`}>
        <small>RANK</small>#{result.rank}
      </div>

      <div className="rec-main">
        <div className="rec-head">
          <Avatar name={result.name} gender={result.gender} />
          <div style={{ minWidth: 0 }}>
            <h3>{result.name}</h3>
            <div className="rec-meta">
              <span><OccupationIcon occupation={result.occupation} /> {result.occupation}</span>
              <span><LuMapPin /> {result.city}</span>
              {result.languages?.length > 0 && <span><LuLanguages /> {result.languages.join(", ")}</span>}
            </div>
          </div>
          <div className="row" style={{ "--gap": "6px", marginLeft: "auto" }}>
            <VerifiedBadge verified={result.is_verified} />
            <SourceBadge source={result.source} label={result.source_label} />
          </div>
        </div>

        <div className="rec-scores">
          <ScoreRing value={result.final_score} tone="rank" size={92} sub="TrueRank" label="TrueRank score R(w,q)" />
          <ScoreRing value={result.similarity_score} tone="sim" size={74} stroke={8} sub="Skill" label="Skill similarity S(w,q)" />
          <ScoreRing value={result.trust_score} tone="trust" size={74} stroke={8} sub="Trust" label="Trust score TS(w)" />
          <div className="stack" style={{ "--gap": "8px", flex: 1, minWidth: 180 }}>
            <div className="row-between small strong">
              <span>Score composition</span>
              <span className="mono muted">{score(result.final_score, 3)}</span>
            </div>
            <Composition simPart={result.score_breakdown.similarity_part} trustPart={result.score_breakdown.trust_part} />
            <div className="legend">
              <span><i style={{ background: "var(--grad-sim)" }} />{lambda.toFixed(2)}×S = {score(result.score_breakdown.similarity_part, 3)}</span>
              <span><i style={{ background: "var(--grad-trust)" }} />{(1 - lambda).toFixed(2)}×TS = {score(result.score_breakdown.trust_part, 3)}</span>
            </div>
          </div>
        </div>

        {result.matched_terms.length > 0 && (
          <div>
            <div className="small strong" style={{ marginBottom: 6 }}>Matched terms <span className="muted">(share of cosine similarity)</span></div>
            <div className="tag-row">
              {result.matched_terms.slice(0, 8).map((t) => (
                <span className="term-chip" key={t.term} title={`processed term: ${t.term}`}>
                  {t.display} <b>+{t.contribution.toFixed(3)}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        {result.relevant_skills.length > 0 && (
          <div>
            <div className="small strong" style={{ marginBottom: 6 }}>Relevant skills</div>
            <div className="tag-row">
              {result.relevant_skills.map((s) => (
                <span className="chip" key={s}>{s}</span>
              ))}
            </div>
          </div>
        )}

        <MetricStrip metrics={result.metrics} experience={result.experience_years} />
        <Reasons explanation={result.explanation} />
      </div>

      <div className="rec-side">
        <Button variant="soft" icon={LuEye} to={profileHref}>View profile</Button>
        {selectable && (
          <Button variant="primary" icon={LuUserCheck} loading={selecting} onClick={() => onSelect(result)}>
            Select worker
          </Button>
        )}
      </div>
    </article>
  );
}

export function WorkerRow({ worker, to, right }) {
  return (
    <Link to={to} className="list-row clickable-row" style={{ color: "inherit" }}>
      <Avatar name={worker.name} gender={worker.gender} size="sm" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="strong truncate">{worker.name}</div>
        <div className="tiny muted truncate">
          {worker.occupation} · {worker.city}
        </div>
      </div>
      {right}
    </Link>
  );
}
