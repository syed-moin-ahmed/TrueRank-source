// Formatting helpers. They only change how a number is shown, never its value.

export const isNum = (v) => typeof v === "number" && !Number.isNaN(v);

/** 0.8423 -> "84%" */
export function pct(value, digits = 0) {
  if (!isNum(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** 0.8423 -> "0.84" */
export function score(value, digits = 2) {
  if (!isNum(value)) return "—";
  return value.toFixed(digits);
}

export function rating(value) {
  if (!isNum(value)) return "—";
  return value.toFixed(1);
}

export function years(value) {
  if (!isNum(value)) return "—";
  const n = Number.isInteger(value) ? value : value.toFixed(1);
  return `${n} yr${value === 1 ? "" : "s"}`;
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#6C47FF,#FF4D8D)",
  "linear-gradient(135deg,#00BFA6,#2E9BFF)",
  "linear-gradient(135deg,#FFAD1F,#FF4D8D)",
  "linear-gradient(135deg,#2E9BFF,#6C47FF)",
  "linear-gradient(135deg,#17B26A,#00BFA6)",
  "linear-gradient(135deg,#FF7A45,#FFAD1F)",
  "linear-gradient(135deg,#B347FF,#2E9BFF)",
];

export function avatarGradient(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateTime(value) {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function date(value) {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(value) {
  const d = parseDate(value);
  if (!d) return "—";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date(value);
}

export const STATUS_LABEL = {
  open: "Open",
  assigned: "Worker selected",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Awaiting worker",
  accepted: "Accepted",
  rejected: "Declined",
  withdrawn: "Withdrawn",
  upheld: "Upheld",
  dismissed: "Dismissed",
  verified: "Verified",
};

export const TRIGGER_LABEL = {
  dataset_import: "Imported from dataset",
  profile_created: "Profile created",
  review: "New rating received",
  job_complete: "Job completed",
  job_withdraw: "Withdrew from a job",
  dispute_reported: "Dispute reported",
  dispute_upheld: "Dispute upheld",
  dispute_dismissed: "Dispute dismissed",
  peer_endorsement: "Peer endorsement",
  manual_recompute: "Recalculated",
};
