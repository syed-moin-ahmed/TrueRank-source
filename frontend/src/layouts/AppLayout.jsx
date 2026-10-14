import { useEffect, useState } from "react";
import {
  LuActivity, LuBadgeCheck, LuBriefcase, LuClipboardList, LuFlag, LuGauge, LuHandshake, LuHouse, LuInbox,
  LuLayoutDashboard, LuLogOut, LuMenu, LuMessageSquare, LuSearch, LuShieldCheck, LuStar, LuUser, LuUserCog, LuUsers,
} from "react-icons/lu";
import { Avatar, Logo } from "../components/ui.jsx";
import { get } from "../services/api.js";
import { NavLink, useRouter } from "../router.jsx";
import { useAuth } from "../services/auth.jsx";

const NAV = {
  requester: [
    { section: "Overview" },
    { to: "/requester", label: "Dashboard", icon: LuLayoutDashboard, exact: true },
    { to: "/requester/find", label: "Find workers", icon: LuSearch },
    { section: "My work" },
    { to: "/requester/requests", label: "Service requests", icon: LuClipboardList },
    { to: "/requester/reviews", label: "Ratings & feedback", icon: LuStar },
    { section: "Account" },
    { to: "/account", label: "Profile", icon: LuUser },
  ],
  worker: [
    { section: "Overview" },
    { to: "/worker", label: "Dashboard", icon: LuLayoutDashboard, exact: true },
    { to: "/worker/profile", label: "My profile", icon: LuUser },
    { section: "Work" },
    { to: "/worker/requests", label: "Requests", icon: LuInbox, badge: "pending" },
    { to: "/worker/jobs", label: "My jobs", icon: LuBriefcase },
    { section: "Reputation" },
    { to: "/worker/trust", label: "Trust score", icon: LuShieldCheck },
    { to: "/worker/ratings", label: "Ratings", icon: LuStar },
    { to: "/worker/peers", label: "Endorse peers", icon: LuHandshake },
    { section: "Account" },
    { to: "/account", label: "Account", icon: LuUserCog },
  ],
  admin: [
    { section: "Overview" },
    { to: "/admin", label: "Dashboard", icon: LuGauge, exact: true },
    { section: "People" },
    { to: "/admin/users", label: "Users", icon: LuUsers },
    { to: "/admin/workers", label: "Workers", icon: LuBriefcase },
    { to: "/admin/verifications", label: "Verifications", icon: LuBadgeCheck, badge: "verifications" },
    { section: "Activity" },
    { to: "/admin/requests", label: "Requests & jobs", icon: LuClipboardList },
    { to: "/admin/reviews", label: "Ratings & feedback", icon: LuMessageSquare },
    { to: "/admin/disputes", label: "Disputes", icon: LuFlag, badge: "disputes" },
    { section: "TrueRank engine" },
    { to: "/admin/trust", label: "Trust metrics", icon: LuShieldCheck },
    { to: "/admin/matching", label: "Matching statistics", icon: LuActivity },
    { section: "Site" },
    { to: "/", label: "Public site", icon: LuHouse, exact: true },
  ],
};

function useBadges(role, path) {
  const [badges, setBadges] = useState({});
  useEffect(() => {
    let alive = true;
    if (role === "worker") {
      get("/jobs", { status: "pending" })
        .then((d) => alive && setBadges({ pending: d.items.length }))
        .catch(() => {});
    } else if (role === "admin") {
      get("/admin/stats")
        .then((d) => alive && setBadges({ disputes: d.totals.open_disputes, verifications: d.totals.pending_verifications }))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [role, path]);
  return badges;
}

export default function AppLayout({ title, crumbs, children }) {
  const { user, logout } = useAuth();
  const { path, navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const badges = useBadges(user.role, path);

  useEffect(() => setOpen(false), [path]);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Navigation">
        <Logo to="/" />
        {NAV[user.role].map((item, i) =>
          item.section ? (
            <div className="side-section" key={`s${i}`}>{item.section}</div>
          ) : (
            <NavLink key={item.to} to={item.to} exact={item.exact} className="side-link">
              <item.icon aria-hidden="true" />
              {item.label}
              {item.badge && badges[item.badge] > 0 && <span className="side-count">{badges[item.badge]}</span>}
            </NavLink>
          )
        )}
        <div className="side-user">
          <Avatar name={user.name} gender={user.gender} size="sm" />
          <div className="who">
            <strong className="truncate">{user.name}</strong>
            <span>{user.role === "requester" ? "Service requester" : user.role === "worker" ? "Skilled worker" : "Administrator"}</span>
          </div>
          <button
            type="button"
            title="Log out"
            aria-label="Log out"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LuLogOut />
          </button>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="btn btn-ghost btn-icon burger" aria-label="Open menu" onClick={() => setOpen(true)}>
              <LuMenu />
            </button>
            <div style={{ minWidth: 0 }}>
              <div className="crumbs">{crumbs || "TrueRank"}</div>
              <div className="strong truncate">{title}</div>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`role-chip role-${user.role}`}>{user.role}</span>
            <Avatar name={user.name} gender={user.gender} size="sm" />
          </div>
        </header>
        <div className="content" key={path}>
          {children}
        </div>
      </div>
    </div>
  );
}
