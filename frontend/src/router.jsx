// Minimal client-side router built on the History API (no external dependency).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const RouterContext = createContext(null);

function currentLocation() {
  return { path: window.location.pathname, search: window.location.search };
}

export function Router({ children }) {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    const onPop = () => setLocation(currentLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname + window.location.search) return;
    if (replace) window.history.replaceState(null, "", to);
    else window.history.pushState(null, "", to);
    setLocation(currentLocation());
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, []);

  const value = useMemo(() => ({ ...location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  return useContext(RouterContext);
}

export function useQuery() {
  const { search } = useRouter();
  return useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);
}

export function matchPath(pattern, path) {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, onClick, ...rest }) {
  const { navigate } = useRouter();
  const handle = (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} className={className} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

export function NavLink({ to, exact = false, className = "", children, ...rest }) {
  const { path } = useRouter();
  const target = to.split("?")[0];
  const active = exact ? path === target : path === target || path.startsWith(target + "/");
  return (
    <Link to={to} className={`${className} ${active ? "active" : ""}`.trim()} aria-current={active ? "page" : undefined} {...rest}>
      {children}
    </Link>
  );
}

export function Redirect({ to }) {
  const { navigate } = useRouter();
  useEffect(() => navigate(to, { replace: true }), [to, navigate]);
  return null;
}
