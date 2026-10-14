// Live benchmark: existing search methods vs TrueRank, computed by the backend on the current database.
// Layout (top to bottom): verdict -> leaderboard -> request-by-request wins -> full table -> one worked example.
import { useEffect, useMemo, useState } from "react";
import {
  LuChevronDown, LuChevronUp, LuCircleAlert, LuCircleCheck, LuCircleMinus, LuCircleX,
  LuScale, LuSearch, LuSparkles, LuTrophy,
} from "react-icons/lu";
import { Button, Card, CardHeader, ErrorState, PageLoader, Select, Tabs } from "./ui.jsx";
import { useApi, useReveal } from "../hooks/index.js";

const TR = "truerank";
const COLORS = { keyword: "#B9B6CF", keyword_rating: "#8E8AA8", tfidf: "#2E9BFF" };

// The four ranking-quality measures. "low" = lower is better.
const METRICS = [
  { key: "precision5", tab: "Good hires", label: "Good hires in the top 5", better: "high",
    hint: "Out of the 5 workers a method recommends, how many are a good hire. This is what a customer feels." },
  { key: "ndcg10", tab: "Ranking quality", label: "Ranking quality (NDCG@10)", better: "high",
    hint: "Are the best workers placed at the very top of the top-10 list, not just somewhere in it?" },
  { key: "mrr", tab: "First good hire", label: "How early the first good hire appears (MRR)", better: "high",
    hint: "100% means the first recommended worker is already a good hire." },
  { key: "risky5", tab: "Risky hires", label: "Risky hires in the top 5", better: "low",
    hint: "Wrong trade or a poor record. Lower is better." },
];
const GAIN_TEXT = {
  precision5: (up) => (up ? "more good hires in the top 5" : "change in good hires"),
  ndcg10: (up) => (up ? "better ranking quality" : "change in ranking quality"),
  mrr: (up) => (up ? "earlier first good hire" : "change in first good hire"),
  risky5: (up) => (up ? "fewer risky hires" : "change in risky hires"),
};
const TABLE_COLS = [...METRICS.map((m) => m.key), "trade5"];
const COL_LABEL = { precision5: "Good hires@5", ndcg10: "NDCG@10", mrr: "MRR", risky5: "Risky hires@5 ↓", trade5: "Right trade@5" };

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const isBetter = (m, a, b) => (m.better === "low" ? a < b : a > b);

/* ------------------------------------------------------------------ small parts */

const REASONS = {
  good: { cls: "good", icon: LuCircleCheck, text: "Good hire" },
  little_history: { cls: "neutral", icon: LuCircleMinus, text: "Little history" },
  low_trust: { cls: "ok", icon: LuCircleAlert, text: "Low trust" },
  wrong_trade: { cls: "bad", icon: LuCircleX, text: "Wrong trade" },
};

function ReasonBadge({ reason }) {
  const r = REASONS[reason] || REASONS.wrong_trade;
  const Icon = r.icon;
  return <span className={`grade ${r.cls}`}><Icon /> {r.text}</span>;
}

function WorkerFacts({ w, trade }) {
  if (w.reason === "wrong_trade") return <span className="bench-why">Request needs a {trade}</span>;
  const bits = [];
  if (w.rating != null) bits.push(`${w.rating.toFixed(1)}★`);
  if (w.completion != null) bits.push(`${Math.round(w.completion * 100)}% completed`);
  bits.push(`${Math.round(w.dispute_rate * 100)}% disputes`);
  return <span className="bench-why">{bits.join(" · ")}</span>;
}

function Leaderboard({ methods, metric }) {
  const sorted = [...methods].sort((a, b) => (metric.better === "low" ? a[metric.key] - b[metric.key] : b[metric.key] - a[metric.key]));
  return (
    <div className="lb">
      {sorted.map((m, i) => {
        const tr = m.key === TR;
        return (
          <div key={m.key} className={`lb-row ${tr ? "is-tr" : ""}`}>
            <span className="lb-rank">{i + 1}</span>
            <span className="lb-name">
              {m.label}
              {tr && i === 0 && <span className="lb-best"><LuTrophy /> Best</span>}
            </span>
            <span className="lb-track">
              <span className="lb-fill" style={{ width: `${Math.max(2, m[metric.key] * 100)}%`, background: tr ? "var(--grad-brand)" : COLORS[m.key] }} />
            </span>
            <span className="lb-val">{pct(m[metric.key])}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ main */

export default function Benchmark() {
  const { data, error, loading, reload } = useApi("/meta/benchmark", { details: 1 });
  const [metricKey, setMetricKey] = useState("precision5");
  const [showExample, setShowExample] = useState(false);
  const [compare, setCompare] = useState("keyword");
  const [qi, setQi] = useState(null);
  useReveal([data, showExample]);

  // Start the example on the request where TrueRank's improvement over keyword search is largest.
  useEffect(() => {
    if (!data || qi !== null) return;
    let best = 0, gap = -Infinity;
    data.per_query.forEach((q, i) => {
      const g = q.methods[TR].precision5 - q.methods.keyword.precision5;
      if (g > gap) { gap = g; best = i; }
    });
    setQi(best);
  }, [data, qi]);

  const summary = useMemo(() => {
    if (!data) return null;
    const tr = data.methods.find((m) => m.key === TR);
    const others = data.methods.filter((m) => m.key !== TR);
    const firstOn = METRICS.filter((m) => others.every((o) => isBetter(m, tr[m.key], o[m.key])));
    const bestOther = (key, better = "high") =>
      others.reduce((a, b) => ((better === "low" ? b[key] < a[key] : b[key] > a[key]) ? b : a));
    const best = {};
    for (const k of TABLE_COLS) {
      const vals = data.methods.map((x) => x[k]);
      best[k] = k === "risky5" ? Math.min(...vals) : Math.max(...vals);
    }
    // Relative improvement of TrueRank over the best existing method on each measure.
    const gains = METRICS.map((m) => {
      const b = bestOther(m.key, m.better);
      const rel = m.better === "low" ? (b[m.key] - tr[m.key]) / b[m.key] : (tr[m.key] - b[m.key]) / b[m.key];
      return { m, b, rel };
    });
    return { tr, others, firstOn, gains, bestP5: bestOther("precision5"), bestRisky: bestOther("risky5", "low"), best };
  }, [data]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { tr, others, firstOn, gains, bestP5, bestRisky, best } = summary;
  const metric = METRICS.find((m) => m.key === metricKey);
  const labelOf = Object.fromEntries(data.methods.map((m) => [m.key, m.label]));
  const n = data.queries;
  const gainP5 = (tr.precision5 - bestP5.precision5) * 100;
  const tradeGap = tr.trade5 < best.trade5;

  return (
    <div className="stack" style={{ "--gap": "24px" }}>
      {/* ---------- 1. headline */}
      <div className="section-head" style={{ margin: "24px auto 4px" }}>
        <span className="eyebrow"><LuScale /> Existing systems vs TrueRank</span>
        <h2>TrueRank recommends <span className="grad-text">better workers</span> than existing methods</h2>
        <p>
          The same {n} everyday service requests were given to three existing search methods and to TrueRank, over{" "}
          {data.workers_evaluated} worker profiles.{" "}
          {firstOn.length === METRICS.length
            ? `TrueRank comes first on all ${METRICS.length} quality measures.`
            : `TrueRank comes first on ${firstOn.length} of ${METRICS.length} quality measures.`}{" "}
          All numbers are computed live by the server.
        </p>
        <p className="bench-def">
          <LuCircleCheck /> <strong>Good hire</strong> = {data.criteria.good_hire.replace(/^Right trade AND /, "right trade + ")}
        </p>
      </div>

      {/* ---------- 2a. relative gains */}
      <div className="gain-grid reveal">
        {gains.map(({ m, b, rel }) => (
          <div className={`gain-tile ${rel > 0 ? "" : "is-neutral"}`} key={m.key}>
            <div className="gain-num">{rel > 0 && m.better !== "low" ? "+" : ""}{Math.abs(rel * 100).toFixed(0)}%</div>
            <div className="gain-label">{GAIN_TEXT[m.key](rel > 0)}</div>
            <div className="gain-foot">TrueRank {pct(tr[m.key])} vs {pct(b[m.key])} ({b.label})</div>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ textAlign: "center", marginTop: -12 }}>
        Each tile compares TrueRank with the best existing method on that measure: (TrueRank − best) ÷ best.
      </p>

      {/* ---------- 2. verdict + leaderboard */}
      <Card className="reveal">
        <div className="bench-verdict">
          <div className="bench-hero">
            <div className="tiny strong muted upper">TrueRank, good hires in the top 5</div>
            <div className="bench-hero-num">{pct(tr.precision5)}</div>
            <div className="bench-vs">
              vs <strong>{pct(bestP5.precision5)}</strong> for the best existing method ({bestP5.label})
            </div>
            {gainP5 > 0 && <div className="bench-gain"><LuSparkles /> {gainP5.toFixed(1)} percentage points more good hires</div>}
            <div className="bench-mini">
              <div><span className="bench-mini-num">{pct(tr.risky5)}</span><span>risky hires in the top 5, vs {pct(bestRisky.risky5)} at best before</span></div>
              <div><span className="bench-mini-num">{pct(tr.mrr)}</span><span>first good hire score (MRR), the highest of all methods</span></div>
            </div>
          </div>

          <div className="bench-board">
            <Tabs tabs={METRICS.map((m) => ({ value: m.key, label: m.tab }))} value={metricKey} onChange={setMetricKey} />
            <div className="small strong mt-16">{metric.label}</div>
            <p className="tiny muted" style={{ margin: "2px 0 12px" }}>{metric.hint}</p>
            <Leaderboard methods={data.methods} metric={metric} />
          </div>
        </div>
      </Card>

      {/* ---------- 3. request by request */}
      <Card className="reveal">
        <CardHeader title="Request by request" icon={LuTrophy} tone="amber" subtitle={`On how many of the ${n} requests TrueRank put more good hires in the top 5`} />
        <div className="stack" style={{ "--gap": "14px" }}>
          {others.map((m) => {
            const h = data.head_to_head[m.key];
            return (
              <div className="h2h" key={m.key}>
                <div className="h2h-label"><span className="strong">TrueRank vs {m.label}</span></div>
                <div className="h2h-bar" role="img" aria-label={`Better on ${h.win}, same on ${h.tie}, worse on ${h.loss}`}>
                  {h.win > 0 && <span className="h2h-win" style={{ flex: h.win }}>{h.win}</span>}
                  {h.tie > 0 && <span className="h2h-tie" style={{ flex: h.tie }}>{h.tie}</span>}
                  {h.loss > 0 && <span className="h2h-loss" style={{ flex: h.loss }}>{h.loss}</span>}
                </div>
                <div className="tiny muted">
                  Better on <strong className="text-green">{h.win}</strong> · same on {h.tie} · worse on {h.loss}
                </div>
              </div>
            );
          })}
          <div className="legend">
            <span><i className="h2h-win" /> TrueRank better</span>
            <span><i className="h2h-tie" /> Same number of good hires</span>
            <span><i className="h2h-loss" /> Existing method better</span>
          </div>
          {data.head_to_head.keyword_rating?.loss > 0 && (
            <p className="tiny muted">
              Rating sort sometimes wins a single request because it lists the highest-rated workers first. But only{" "}
              {pct(data.methods.find((m) => m.key === "keyword_rating").trade5)} of its top-5 picks are the right trade, so on average it
              is well behind TrueRank.
            </p>
          )}
        </div>
      </Card>

      {/* ---------- 4. full table */}
      <Card className="card-flush reveal">
        <div style={{ padding: "22px 22px 0" }}>
          <CardHeader title="All results" icon={LuScale} tone="sky" subtitle={`Average over ${n} requests · top-${data.k} lists · best value in each column highlighted`} />
        </div>
        <div className="table-wrap">
          <table className="table paper-table">
            <thead>
              <tr>
                <th>Method</th>
                {TABLE_COLS.map((k) => <th className="num" key={k}>{COL_LABEL[k]}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.methods.map((m) => (
                <tr key={m.key} className={m.key === TR ? "hl" : ""}>
                  <td>
                    <div className="strong">{m.label}</div>
                    <div className="tiny muted">{m.description}</div>
                  </td>
                  {TABLE_COLS.map((k) => (
                    <td key={k} className={`num ${Math.abs(m[k] - best[k]) < 1e-9 ? "best" : ""}`}>{pct(m[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tradeGap && (
          <p className="tiny muted" style={{ padding: "0 22px 18px" }}>
            Right trade@5 only checks the trade, and TrueRank uses the same skill matching as TF-IDF, so both find the right trade about
            equally often ({pct(tr.trade5)} vs {pct(best.trade5)}). TrueRank’s gain comes from choosing the <em>reliable</em> workers
            within that trade.
          </p>
        )}
      </Card>

      {/* ---------- 5. one worked example (optional) */}
      <Card className="reveal">
        <CardHeader
          title="See it on one request"
          icon={LuSearch}
          tone="sky"
          subtitle="The top 5 workers from an existing method and from TrueRank, side by side"
          action={
            <Button variant="soft" size="sm" iconRight={showExample ? LuChevronUp : LuChevronDown} onClick={() => setShowExample((v) => !v)}>
              {showExample ? "Hide" : "Show example"}
            </Button>
          }
        />
        {showExample && qi !== null && (
          <Example data={data} qi={qi} setQi={setQi} compare={compare} setCompare={setCompare} labelOf={labelOf} />
        )}
      </Card>
    </div>
  );
}

function Example({ data, qi, setQi, compare, setCompare, labelOf }) {
  const q = data.per_query[qi];
  const base = q.methods[compare];
  const mine = q.methods[TR];
  const baseIds = new Set(base.top5.map((w) => w.id));
  const myIds = new Set(mine.top5.map((w) => w.id));
  const goodCount = (list) => list.top5.filter((w) => w.reason === "good").length;
  const g1 = goodCount(mine), g0 = goodCount(base);
  const dropped = base.top5.filter((w) => !myIds.has(w.id));
  const droppedWrong = dropped.filter((w) => w.reason === "wrong_trade").length;
  const droppedRisky = dropped.filter((w) => w.reason === "low_trust").length;
  const addedGood = mine.top5.filter((w) => !baseIds.has(w.id) && w.reason === "good").length;

  let sentence;
  if (g1 > g0) {
    const parts = [];
    if (droppedWrong) parts.push(`${droppedWrong} wrong-trade`);
    if (droppedRisky) parts.push(`${droppedRisky} low-trust`);
    sentence = `${parts.length ? `TrueRank left out ${parts.join(" and ")} worker${droppedWrong + droppedRisky > 1 ? "s" : ""}` : "TrueRank changed the order"}${
      addedGood ? ` and brought in ${addedGood} reliable ${q.trade.toLowerCase()}${addedGood > 1 ? "s" : ""}` : ""
    }.`;
  } else if (g1 === g0) {
    sentence = "On this request both methods find the same number of good hires.";
  } else {
    sentence = `On this request ${labelOf[compare]} finds more good hires. The averages above cover all ${data.queries} requests.`;
  }

  return (
    <div className="stack mt-8" style={{ "--gap": "12px" }}>
      <div className="row" style={{ "--gap": "10px" }}>
        <Select value={qi} onChange={(e) => setQi(Number(e.target.value))} aria-label="Service request" style={{ flex: 2, minWidth: 220 }}>
          {data.per_query.map((x, i) => <option key={i} value={i}>{x.query}</option>)}
        </Select>
        <Select value={compare} onChange={(e) => setCompare(e.target.value)} aria-label="Compare with" style={{ flex: 1, minWidth: 160 }}>
          {data.methods.filter((m) => m.key !== TR).map((m) => <option key={m.key} value={m.key}>Compare with: {m.label}</option>)}
        </Select>
      </div>

      <div className="bench-request">
        <span className="tiny muted">Customer request</span>
        <strong>“{q.query}”</strong>
        <span className="tiny muted">Needs a <strong>{q.trade}</strong></span>
      </div>

      <div className={`bench-result ${g1 > g0 ? "win" : g1 === g0 ? "tie" : "loss"}`}>
        <strong>TrueRank: {g1} of 5 good hires</strong>
        <span>·</span>
        <span>{labelOf[compare]}: {g0} of 5</span>
        <span className="bench-result-text">{sentence}</span>
      </div>

      <div className="bench-compare">
        {[compare, TR].map((key) => {
          const list = q.methods[key];
          const other = key === TR ? baseIds : myIds;
          return (
            <div key={key} className={`bench-list ${key === TR ? "is-tr" : ""}`}>
              <div className="bench-list-head">
                <span>{labelOf[key]}</span>
                <span>{goodCount(list)} / 5 good</span>
              </div>
              {list.top5.length === 0 && <div className="tiny muted">No results</div>}
              {list.top5.map((w, i) => (
                <div className="bench-row" key={w.id}>
                  <span className="bench-rank">{i + 1}</span>
                  <span className="bench-name">
                    {w.name}<small>{w.occupation}</small>
                  </span>
                  <span className="bench-badges">
                    <ReasonBadge reason={w.reason} />
                    {!other.has(w.id) && (
                      <span className={`bench-tag ${key === TR ? "new" : "out"}`}>{key === TR ? "New pick" : "Not picked by TrueRank"}</span>
                    )}
                  </span>
                  <WorkerFacts w={w} trade={q.trade} />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="legend">
        <span><ReasonBadge reason="good" /> right trade, reliable record</span>
        <span><ReasonBadge reason="little_history" /> right trade, not enough jobs yet</span>
        <span><ReasonBadge reason="low_trust" /> right trade, poor record</span>
        <span><ReasonBadge reason="wrong_trade" /> different trade</span>
      </div>
      <p className="tiny muted">One request only, for illustration. The results above are averaged over all {data.queries} requests.</p>
    </div>
  );
}
