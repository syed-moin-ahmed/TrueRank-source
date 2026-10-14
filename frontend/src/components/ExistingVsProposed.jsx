// "Existing system vs proposed system" — the comparison guides and examiners expect.
// Numbers come only from the research paper (Table 1 and Table 2), passed in from /meta/research-results.
import { LuCircleCheck, LuCircleX, LuScale, LuShieldCheck, LuTarget, LuTrendingUp, LuTrophy } from "react-icons/lu";
import { Card, CardHeader } from "./ui.jsx";

// What each kind of system can do. TrueRank column = what this project implements.
const FEATURES = [
  ["How workers are matched", "Exact keyword search", "NLP: preprocessing + TF-IDF + cosine similarity"],
  ["Needs a resume or degree", "Yes, resume / qualification based", "No, skills and work history only"],
  ["How reliable a worker is", "Star rating only, or not at all", "Composite Trust Score (rating, completion, endorsements, disputes)"],
  ["Disputes and withdrawn jobs", "Not counted", "Lower the worker's trust score"],
  ["Peer endorsements", "Not used", "Part of the trust score"],
  ["Final ranking", "Keyword count or rating sort", "R = 0.7 × skill match + 0.3 × trust"],
  ["Why a worker was recommended", "Not shown", "Matched skill words and trust breakdown shown"],
  ["New workers with no history", "Usually pushed to the bottom", "Fair neutral start, marked “Not enough data”"],
  ["Learns from completed jobs", "No", "Trust is recalculated after every job, rating and dispute"],
];

const f1 = (v) => v.toFixed(1);

export default function ExistingVsProposed({ data }) {
  const models = data.model_comparison;
  const tr = models.find((m) => m.model.startsWith("TrueRank"));
  const existing = models.filter((m) => m !== tr);
  const best = existing.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));
  const noTrust = data.component_isolation.find((c) => /trust/i.test(c.variant));
  const baseline = data.component_isolation.find((c) => /baseline/i.test(c.variant));

  // Fewer wrong matches: error rate = 100 − accuracy.
  const errBest = 100 - best.accuracy;
  const errTr = 100 - tr.accuracy;
  const fewerErrors = ((errBest - errTr) / errBest) * 100;

  const tiles = [
    { icon: LuTrophy, tone: "", big: `${f1(tr.accuracy)}%`, label: "Accuracy, the highest of all models",
      foot: `Best existing model: ${best.model} ${f1(best.accuracy)}%` },
    { icon: LuTarget, tone: "green", big: `${fewerErrors.toFixed(0)}%`, label: "fewer wrong matches",
      foot: `Error rate ${f1(errTr)}% vs ${f1(errBest)}% (${best.model})` },
    baseline && { icon: LuTrendingUp, tone: "sky", big: `+${f1(tr.accuracy - baseline.accuracy)}`, label: "points over plain TF-IDF matching",
      foot: `${baseline.variant} ${f1(baseline.accuracy)}% → TrueRank ${f1(tr.accuracy)}%` },
    noTrust && { icon: LuShieldCheck, tone: "amber", big: `+${f1(tr.accuracy - noTrust.accuracy)}`, label: "points added by the trust score",
      foot: `${f1(noTrust.accuracy)}% without trust → ${f1(tr.accuracy)}% with trust` },
  ].filter(Boolean);

  const winsAll = existing.every((m) => ["accuracy", "precision", "recall", "f1"].every((k) => tr[k] > m[k]));

  return (
    <div className="stack" style={{ "--gap": "20px" }}>
      <div className="section-head" style={{ margin: "0 auto" }}>
        <span className="eyebrow"><LuScale /> Existing system vs proposed system</span>
        <h2>TrueRank <span className="grad-text">outperforms</span> every existing method</h2>
        <p>
          {winsAll
            ? `Higher accuracy, precision, recall and F1-score than all ${existing.length} existing models in the research evaluation, and it does things existing systems cannot.`
            : `Compared with ${existing.length} existing models in the research evaluation.`}
        </p>
      </div>

      <div className="evp-tiles">
        {tiles.map((t) => (
          <Card className="evp-tile reveal" key={t.label}>
            <span className={`icon-bubble ${t.tone}`}><t.icon /></span>
            <div className="evp-big">{t.big}</div>
            <div className="evp-label">{t.label}</div>
            <div className="evp-foot">{t.foot}</div>
          </Card>
        ))}
      </div>

      <Card className="card-flush reveal">
        <div style={{ padding: "22px 22px 0" }}>
          <CardHeader title="What changes with TrueRank" icon={LuCircleCheck} tone="green" subtitle="Typical existing job portals and service listings compared with the proposed system" />
        </div>
        <div className="table-wrap">
          <table className="table evp-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Existing systems</th>
                <th className="evp-tr-head">TrueRank (proposed)</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(([feature, old, mine]) => (
                <tr key={feature}>
                  <td className="strong">{feature}</td>
                  <td className="evp-old" data-label="Existing systems"><div className="evp-cell"><LuCircleX /><span>{old}</span></div></td>
                  <td className="evp-new" data-label="TrueRank"><div className="evp-cell"><LuCircleCheck /><span>{mine}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
