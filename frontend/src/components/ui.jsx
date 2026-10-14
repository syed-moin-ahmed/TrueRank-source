import { useEffect, useId, useState } from "react";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuStar, LuTriangleAlert, LuX, LuBadgeCheck, LuDatabase } from "react-icons/lu";
import { useCountUp } from "../hooks/index.js";
import { Link } from "../router.jsx";
import { avatarGradient, initials, STATUS_LABEL } from "../utils/format.js";
import PersonAvatar from "./PersonAvatar.jsx";

export function Logo({ to = "/", sub = true }) {
  return (
    <Link to={to} className="logo" aria-label="TrueRank home">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 13.2l4.2 4.2L19 7.6" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14.6 7.4H19v4.4" stroke="#FFD166" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        <span className="logo-word" aria-label="TrueRank">
          {"TRUE".split("").map((ch, i) => <span key={`t${i}`} className="lw" style={{ "--i": i }}>{ch}</span>)}
          {"RANK".split("").map((ch, i) => <span key={`r${i}`} className="lw logo-rank" style={{ "--i": i + 4, "--j": i }}>{ch}</span>)}
        </span>
        {sub && <small>Trust-aware matching</small>}
      </span>
    </Link>
  );
}

export function Button({ variant = "", size = "", icon: Icon, iconRight: IconRight, loading = false, className = "", children, to, ...rest }) {
  const cls = `btn ${variant ? `btn-${variant}` : ""} ${size ? `btn-${size}` : ""} ${className}`.replace(/\s+/g, " ").trim();
  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight aria-hidden="true" />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} disabled={loading || rest.disabled} {...rest}>
      {content}
    </button>
  );
}

export function Card({ className = "", hover = false, children, style, ...rest }) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon: Icon, tone = "", action, subtitle }) {
  return (
    <div className="card-header">
      <div>
        <div className="card-title">
          {Icon && (
            <span className={`icon-bubble ${tone}`}>
              <Icon />
            </span>
          )}
          {title}
        </div>
        {subtitle && <p className="muted small mt-8">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function IconBubble({ icon: Icon, tone = "", className = "", style }) {
  return (
    <span className={`icon-bubble ${tone} ${className}`} style={style}>
      <Icon />
    </span>
  );
}

export function StatusPill({ status }) {
  return <span className={`status-pill status-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function VerifiedBadge({ verified }) {
  if (!verified) return null;
  return (
    <span className="badge badge-verified" title="Verified worker">
      <LuBadgeCheck /> Verified
    </span>
  );
}

export function SourceBadge({ source, label }) {
  if (source === "registered") return <span className="badge badge-violet">Registered</span>;
  return (
    <span className={`badge ${source === "demo_seed" ? "badge-demo" : "badge-sky"}`} title={label}>
      <LuDatabase /> {source === "demo_seed" ? "Demo data" : "Dataset"}
    </span>
  );
}

export function Avatar({ name, gender, size = "", initialsOnly = false }) {
  if (initialsOnly || !name) {
    return (
      <span className={`avatar ${size}`} style={{ background: avatarGradient(name) }} aria-hidden="true">
        {initials(name)}
      </span>
    );
  }
  return (
    <span className={`avatar avatar-photo ${size}`} title={name} aria-hidden="true">
      <PersonAvatar name={name} gender={gender} />
    </span>
  );
}

export function Stars({ value, size = 16 }) {
  if (value === null || value === undefined) return <span className="muted small">No ratings yet</span>;
  return (
    <span className="stars" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <LuStar key={i} className={value >= i - 0.25 ? "" : "off"} style={{ width: size, height: size, fill: value >= i - 0.25 ? "currentColor" : "none" }} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const labels = ["", "Poor", "Below average", "Good", "Very good", "Excellent"];
  return (
    <div className="stack" style={{ "--gap": "6px" }}>
      <div className="stars-input" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            className={(hover || value) >= i ? "on" : ""}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
          >
            <LuStar />
          </button>
        ))}
      </div>
      <span className="small strong" style={{ color: "var(--amber-600)", minHeight: 20 }}>{labels[hover || value]}</span>
    </div>
  );
}

export function Field({ label, hint, error, children, right }) {
  return (
    <label className="field">
      {label && (
        <span className="field-label">
          <span>{label}</span>
          {right}
        </span>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Input({ error, className = "", ...rest }) {
  return <input className={`input ${error ? "has-error" : ""} ${className}`} {...rest} />;
}

export function Textarea({ error, className = "", ...rest }) {
  return <textarea className={`textarea ${error ? "has-error" : ""} ${className}`} {...rest} />;
}

export function Select({ error, className = "", children, ...rest }) {
  return (
    <select className={`select ${error ? "has-error" : ""} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
      {label}
    </label>
  );
}

export function ChipInput({ values, onChange, placeholder, error, tone = "" }) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const add = (raw) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const lower = values.map((v) => v.toLowerCase());
    const next = [...values];
    parts.forEach((p) => {
      if (!lower.includes(p.toLowerCase())) {
        next.push(p.slice(0, 60));
        lower.push(p.toLowerCase());
      }
    });
    onChange(next);
    setDraft("");
  };
  return (
    <div className="chip-input" style={error ? { borderColor: "var(--red)" } : undefined} onClick={() => document.getElementById(id)?.focus()}>
      {values.map((v) => (
        <span className={`chip ${tone}`} key={v}>
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <LuX />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={values.length ? "Add another…" : placeholder}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
      />
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={`tab ${value === t.value ? "active" : ""}`} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="muted small mt-8">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" className="btn-icon" icon={LuX} onClick={onClose} aria-label="Close" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner />
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

export function SkeletonCards({ count = 3, height = 120 }) {
  return (
    <div className="stack">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} style={{ borderRadius: 22 }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = LuInfo, title, children, action, tone = "" }) {
  return (
    <div className="empty">
      <IconBubble icon={Icon} tone={tone} />
      <h4>{title}</h4>
      {children && <p className="small" style={{ maxWidth: 420 }}>{children}</p>}
      {action}
    </div>
  );
}

const ALERT_ICONS = { info: LuInfo, warn: LuTriangleAlert, error: LuCircleAlert, success: LuCircleCheck, violet: LuInfo };
export function Alert({ type = "info", children, title }) {
  const Icon = ALERT_ICONS[type];
  return (
    <div className={`alert alert-${type}`} role={type === "error" ? "alert" : undefined}>
      <Icon />
      <div>
        {title && <div className="strong">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <Alert type="error" title="Could not load this page">
      {error?.message || "Unknown error"}{" "}
      {onRetry && (
        <button className="btn btn-sm btn-danger mt-8" onClick={onRetry}>
          Try again
        </button>
      )}
    </Alert>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="page-header page-enter">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 12 }}>{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function StatTile({ label, value, format = (v) => Math.round(v).toLocaleString(), icon: Icon, tone = "", accent, foot, style }) {
  const animated = useCountUp(typeof value === "number" ? value : null);
  const shown = typeof value === "number" ? format(animated) : value ?? "—";
  return (
    <Card className="stat-tile card-hover" style={{ "--accent": accent, ...style }}>
      <div className="row-between">
        <span className="stat-label">{label}</span>
        {Icon && <IconBubble icon={Icon} tone={tone} />}
      </div>
      <div className="stat-value">{shown}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </Card>
  );
}

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "unspecified", label: "Prefer not to say" },
];

/** Gender picker with a live preview of the generated profile picture. */
export function GenderPicker({ name, value, onChange }) {
  return (
    <div className="gender-picker" role="radiogroup" aria-label="Gender (used for your profile picture)">
      {GENDER_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`gender-option ${value === o.value ? "active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          <Avatar name={name || "New member"} gender={o.value} size="sm" />
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
