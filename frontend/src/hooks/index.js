import { useCallback, useEffect, useRef, useState } from "react";
import { get } from "../services/api.js";

/** Load data from a GET endpoint. Returns { data, error, loading, reload }. */
export function useApi(path, params) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const key = path ? path + JSON.stringify(params || {}) : null;
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await get(path, params);
      if (id === latest.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === latest.current) setState({ data: null, error, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

/** Animate a number from its previous value to `value`. */
export function useCountUp(value, duration = 1100) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) return undefined;
    const start = performance.now();
    const initial = from.current;
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(initial + (value - initial) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return display;
}

/** Adds .is-visible to elements with .reveal when they scroll into view. */
export function useReveal(deps = []) {
  useEffect(() => {
    const nodes = document.querySelectorAll(".reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** True once the element has been on screen (used to start chart animations). */
export function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return undefined;
    }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    // Fallback: always show the final values after a moment, even if never scrolled to (e.g. printing).
    const timer = setTimeout(() => setInView(true), 2500);
    return () => {
      obs.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return [ref, inView];
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · TrueRank` : "TrueRank · Trust-Aware Worker Matching";
  }, [title]);
}

/** 3D tilt: elements with [data-tilt] rotate towards the mouse with a moving light reflection. */
export function useTilt(deps = []) {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (window.matchMedia?.("(hover: none)").matches) return undefined;
    const els = Array.from(document.querySelectorAll("[data-tilt]"));
    const cleanups = els.map((el) => {
      const max = Number(el.dataset.tiltMax || 10);
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.transition = "transform 0.08s linear";
        el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(0)`;
        el.style.setProperty("--shine-x", `${px * 100}%`);
        el.style.setProperty("--shine-y", `${py * 100}%`);
        el.classList.add("tilting");
      };
      const onLeave = () => {
        el.style.transition = "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
        el.classList.remove("tilting");
      };
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      return () => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      };
    });
    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
