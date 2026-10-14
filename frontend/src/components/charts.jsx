// Small hand-written SVG charts (no chart library needed). All values come from the API.
import { useEffect, useId, useState } from "react";
import { useCountUp, useInView } from "../hooks/index.js";

const TONES = {
  sim: ["#00BFA6", "#2E9BFF"],
  trust: ["#FFC23D", "#FF7A45"],
  rank: ["#6C47FF", "#FF4D8D"],
  green: ["#17B26A", "#00BFA6"],
  sky: ["#2E9BFF", "#6C47FF"],
};

/** Circular score (value in [0,1]); null shows "n/a". */
export function ScoreRing({ value, size = 84, stroke = 9, tone = "rank", label, sub, digits = 0, asDecimal = false }) {
  const id = useId().replace(/:/g, "");
  const [ref, inView] = useInView();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const has = typeof value === "number";
  const shown = useCountUp(has && inView ? value : null);
  const offset = c * (1 - (has && inView ? Math.max(0, Math.min(1, value)) : 0));
  const [a, b] = TONES[tone] || TONES.rank;
  // Before the ring scrolls into view, show the real value (never a misleading 0).
  const display = inView ? shown : value;
  const text = !has ? "n/a" : asDecimal ? display.toFixed(2) : `${(display * 100).toFixed(digits)}%`;
  return (
    <div className="ring" ref={ref} style={{ width: size, height: size }} title={label ? `${label}: ${has ? value.toFixed(4) : "not enough data"}` : undefined}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} />
            <stop offset="100%" stopColor={b} />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="ring-value" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke={`url(#g${id})`} strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <div className="ring-label">
        <div>
          <div className="ring-num" style={{ fontSize: size * 0.22 }}>{text}</div>
          {sub && <div className="ring-sub">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/** Horizontal progress bar. value null -> striped "no data" bar. */
export function Bar({ value, tone = "", thin = false, thick = false }) {
  const [ref, inView] = useInView();
  const has = typeof value === "number";
  return (
    <div ref={ref} className={`bar ${tone} ${thin ? "thin" : ""} ${thick ? "thick" : ""} ${has ? "" : "nodata"}`} role="presentation">
      {has && <span style={{ width: inView ? `${Math.max(0, Math.min(1, value)) * 100}%` : 0 }} />}
    </div>
  );
}

/** Shows R = λS + (1-λ)TS as two stacked segments. */
export function Composition({ simPart, trustPart }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} className="composition" title={`λ·S = ${simPart.toFixed(3)}   (1-λ)·TS = ${trustPart.toFixed(3)}`}>
      <span className="c-sim" style={{ width: inView ? `${simPart * 100}%` : 0 }} />
      <span className="c-trust" style={{ width: inView ? `${trustPart * 100}%` : 0 }} />
    </div>
  );
}

function useTip() {
  const [tip, setTip] = useState(null);
  const show = (e, text) => setTip({ x: e.clientX, y: e.clientY, text });
  const hide = () => setTip(null);
  const node = tip ? <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div> : null;
  return { show, hide, node };
}

/** Vertical bar chart. items: [{label, value, color?}] */
export function BarChart({ items, height = 220, max, format = (v) => (Number.isInteger(v) ? v : Math.round(v * 10) / 10), tickFormat, colors = ["#6C47FF", "#FF4D8D"], showValues = true, labelEvery = 1, yLabel }) {
  const id = useId().replace(/:/g, "");
  const [ref, inView] = useInView();
  const tip = useTip();
  const W = 640;
  const pad = { l: 36, r: 8, t: 18, b: 34 };
  const rawTop = max ?? Math.max(1, ...items.map((i) => i.value));
  const top = max ?? Math.ceil(rawTop / 4) * 4;
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const bw = innerW / Math.max(1, items.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  return (
    <div ref={ref}>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={yLabel || "bar chart"}>
        <defs>
          <linearGradient id={`b${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => {
          const y = pad.t + innerH - (t / top) * innerH;
          return (
            <g key={i}>
              <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y} y2={y} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end">{(tickFormat || format)(t)}</text>
            </g>
          );
        })}
        {inView &&
          items.map((it, i) => {
            const h = (it.value / top) * innerH;
            const x = pad.l + i * bw + bw * 0.14;
            const w = bw * 0.72;
            const y = pad.t + innerH - h;
            return (
              <g key={i}>
                <rect
                  className="bar-rect"
                  x={x}
                  y={y}
                  width={w}
                  height={Math.max(0, h)}
                  rx={Math.min(8, w / 3)}
                  fill={it.color || `url(#b${id})`}
                  style={{ animationDelay: `${i * 35}ms` }}
                  onMouseMove={(e) => tip.show(e, `${it.label}: ${format(it.value)}`)}
                  onMouseLeave={tip.hide}
                />
                {showValues && it.value > 0 && bw > 26 && (
                  <text x={x + w / 2} y={y - 5} textAnchor="middle" style={{ fill: "var(--ink-700)", fontWeight: 800 }}>{format(it.value)}</text>
                )}
                {i % labelEvery === 0 && (
                  <text x={x + w / 2} y={height - 12} textAnchor="middle">{it.label}</text>
                )}
              </g>
            );
          })}
      </svg>
      {tip.node}
    </div>
  );
}

/** Line/area chart. points: [{label, value}] ; values usually in [0,1]. */
export function LineChart({ points, height = 220, min = 0, max = 1, format = (v) => v.toFixed(2), color = ["#6C47FF", "#FF4D8D"] }) {
  const id = useId().replace(/:/g, "");
  const [ref, inView] = useInView();
  const tip = useTip();
  const W = 640;
  const pad = { l: 40, r: 14, t: 16, b: 30 };
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const n = points.length;
  const x = (i) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => pad.t + innerH - ((v - min) / (max - min || 1)) * innerH;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = n ? `${d} L${x(n - 1)},${pad.t + innerH} L${x(0)},${pad.t + innerH} Z` : "";
  let len = 0;
  for (let i = 1; i < n; i += 1) len += Math.hypot(x(i) - x(i - 1), y(points[i].value) - y(points[i - 1].value));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + t * (max - min));
  const every = Math.max(1, Math.ceil(n / 7));
  return (
    <div ref={ref}>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="line chart">
        <defs>
          <linearGradient id={`l${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color[0]} />
            <stop offset="100%" stopColor={color[1]} />
          </linearGradient>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color[0]} stopOpacity=".28" />
            <stop offset="100%" stopColor={color[1]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {inView && n > 0 && (
          <>
            <path className="area-path" d={area} fill={`url(#a${id})`} />
            <path className="line-path" d={d} fill="none" stroke={`url(#l${id})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ "--len": len || 1 }} />
            {points.map((p, i) => (
              <circle
                key={i}
                className="pt"
                cx={x(i)}
                cy={y(p.value)}
                r={n > 30 ? 2.5 : 4.5}
                fill="#fff"
                stroke={color[0]}
                strokeWidth="2.5"
                onMouseMove={(e) => tip.show(e, `${p.label}: ${format(p.value)}${p.note ? ` · ${p.note}` : ""}`)}
                onMouseLeave={tip.hide}
              />
            ))}
          </>
        )}
        {points.map((p, i) => (i % every === 0 || i === n - 1 ? <text key={i} x={x(i)} y={height - 8} textAnchor="middle">{p.label}</text> : null))}
      </svg>
      {tip.node}
    </div>
  );
}

/** Donut chart. items: [{label, value, color}] */
export function Donut({ items, size = 170, stroke = 26, centerLabel, centerValue }) {
  const [ref, inView] = useInView();
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-wrap" ref={ref}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efedf8" strokeWidth={stroke} />
          {items.map((it, i) => {
            const len = (it.value / total) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={it.color}
                strokeWidth={stroke}
                strokeDasharray={inView ? `${Math.max(0, len - 2)} ${c}` : `0 ${c}`}
                strokeDashoffset={-acc}
              >
                <title>{`${it.label}: ${it.value}`}</title>
              </circle>
            );
            acc += len;
            return el;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: size * 0.17, letterSpacing: "-0.03em" }}>{centerValue ?? total}</div>
            <div className="tiny muted strong">{centerLabel}</div>
          </div>
        </div>
      </div>
      <div className="stack" style={{ "--gap": "8px" }}>
        {items.map((it) => (
          <div key={it.label} className="row small strong" style={{ "--gap": "8px" }}>
            <i style={{ width: 12, height: 12, borderRadius: 4, background: it.color, display: "inline-block" }} />
            <span>{it.label}</span>
            <span className="muted mono">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars list. items: [{label, value, display?}] values in [0, max] */
export function HBars({ items, max, tone = "" }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value || 0));
  return (
    <div>
      {items.map((it) => (
        <div className="hbar" key={it.label}>
          <span className="truncate" title={it.label}>{it.label}</span>
          <Bar value={it.value === null || it.value === undefined ? null : it.value / top} tone={it.tone || tone} />
          <span className="num">{it.display ?? it.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Animated number for big displays */
export function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString() }) {
  const v = useCountUp(typeof value === "number" ? value : null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <>{typeof value === "number" && ready ? format(v) : "—"}</>;
}
