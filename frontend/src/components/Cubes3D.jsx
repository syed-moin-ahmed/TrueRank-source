// Floating 3D cubes (real 6-face CSS 3D boxes) over a drifting constellation network.
// Pure CSS transforms + one small canvas — no 3D library. Moves with the mouse (parallax).
import { useEffect, useRef } from "react";
const PRESETS = {
  hero: [
    // x, y in % of the scene; s = size px; d = depth (parallax); t = tint; dur = spin seconds; fl = float delay; a = float height
    { x: 57, y: 12, s: 84, d: 1.5, t: "pearl", dur: 18, fl: 0, a: 34 },
    { x: 70, y: 6, s: 34, d: 0.7, t: "pearl", dur: 14, fl: 2.4, a: 22 },
    { x: 80, y: 11, s: 46, d: 0.9, t: "pearl", dur: 16, fl: 1.1, a: 28 },
    { x: 94, y: 12, s: 58, d: 1.2, t: "violet", dur: 15, fl: 1.2, a: 30 },
    { x: 101, y: 30, s: 36, d: 0.6, t: "pearl", dur: 13, fl: 3.0, a: 24 },
    { x: 49, y: 31, s: 34, d: 0.6, t: "teal", dur: 12, fl: 2.6, a: 26 },
    { x: 52, y: 52, s: 26, d: 0.4, t: "pearl", dur: 11, fl: 0.4, a: 20 },
    { x: 50, y: 70, s: 30, d: 0.5, t: "violet", dur: 12, fl: 1.9, a: 24 },
    { x: 97, y: 52, s: 78, d: 1.7, t: "pearl", dur: 20, fl: 2.1, a: 36 },
    { x: 103, y: 74, s: 40, d: 0.8, t: "pink", dur: 14, fl: 0.8, a: 26 },
    { x: 60, y: 90, s: 44, d: 1.0, t: "pearl", dur: 16, fl: 1.4, a: 28 },
    { x: 72, y: 92, s: 70, d: 1.4, t: "pearl", dur: 19, fl: 0.9, a: 32 },
    { x: 84, y: 88, s: 40, d: 0.8, t: "pink", dur: 13, fl: 1.6, a: 24 },
    { x: 92, y: 94, s: 28, d: 0.5, t: "teal", dur: 11, fl: 2.8, a: 20 },
    { x: 66, y: 4, s: 22, d: 0.4, t: "violet", dur: 10, fl: 3.3, a: 18 },
    { x: 88, y: 30, s: 20, d: 0.3, t: "pearl", dur: 10, fl: 0.2, a: 16 },
    { x: 62, y: 46, s: 24, d: 0.4, t: "pearl", dur: 11, fl: 1.3, a: 18 },
    { x: 46, y: 12, s: 28, d: 0.5, t: "pink", dur: 12, fl: 0.5, a: 20 },
    { x: 86, y: 3, s: 30, d: 0.6, t: "teal", dur: 13, fl: 2.2, a: 18 },
    { x: 104, y: 6, s: 50, d: 1.1, t: "pearl", dur: 17, fl: 1.0, a: 26 },
    { x: 104, y: 94, s: 54, d: 1.2, t: "violet", dur: 16, fl: 2.7, a: 28 },
    { x: 55, y: 98, s: 26, d: 0.5, t: "teal", dur: 12, fl: 0.3, a: 18 },
    { x: 78, y: 99, s: 24, d: 0.4, t: "pearl", dur: 11, fl: 1.8, a: 16 },
    { x: 46, y: 48, s: 18, d: 0.3, t: "pearl", dur: 10, fl: 2.9, a: 14 },
  ],
  banner: [
    { x: 6, y: 26, s: 56, d: 1.2, t: "pearl", dur: 17, fl: 0, a: 30 },
    { x: 15, y: 70, s: 32, d: 0.8, t: "violet", dur: 13, fl: 1.4, a: 24 },
    { x: 24, y: 18, s: 22, d: 0.5, t: "teal", dur: 11, fl: 2.4, a: 18 },
    { x: 3, y: 82, s: 26, d: 0.6, t: "pearl", dur: 12, fl: 0.6, a: 20 },
    { x: 87, y: 34, s: 64, d: 1.4, t: "pearl", dur: 19, fl: 0.7, a: 32 },
    { x: 95, y: 72, s: 36, d: 0.9, t: "pink", dur: 14, fl: 2.2, a: 24 },
    { x: 77, y: 80, s: 24, d: 0.5, t: "teal", dur: 11, fl: 1.1, a: 18 },
    { x: 78, y: 16, s: 28, d: 0.6, t: "violet", dur: 12, fl: 2.9, a: 20 },
    { x: 30, y: 84, s: 20, d: 0.4, t: "pearl", dur: 10, fl: 1.7, a: 16 },
    { x: 70, y: 52, s: 22, d: 0.4, t: "pearl", dur: 11, fl: 0.4, a: 16 },
    { x: 100, y: 10, s: 42, d: 1.0, t: "violet", dur: 15, fl: 2.0, a: 24 },
    { x: 12, y: 46, s: 18, d: 0.3, t: "pink", dur: 10, fl: 2.6, a: 14 },
  ],
  dark: [
    { x: 70, y: 14, s: 80, d: 1.4, t: "glass", dur: 18, fl: 0, a: 34 },
    { x: 88, y: 40, s: 46, d: 0.9, t: "violet", dur: 14, fl: 1.3, a: 26 },
    { x: 60, y: 66, s: 58, d: 1.2, t: "glass", dur: 17, fl: 0.6, a: 30 },
    { x: 86, y: 82, s: 32, d: 0.6, t: "pink", dur: 12, fl: 2.0, a: 22 },
    { x: 48, y: 36, s: 26, d: 0.5, t: "glass", dur: 11, fl: 2.6, a: 20 },
    { x: 92, y: 8, s: 30, d: 0.6, t: "teal", dur: 12, fl: 1.8, a: 20 },
    { x: 38, y: 88, s: 40, d: 0.8, t: "glass", dur: 15, fl: 0.9, a: 24 },
    { x: 20, y: 22, s: 24, d: 0.4, t: "glass", dur: 10, fl: 3.1, a: 18 },
    { x: 76, y: 56, s: 22, d: 0.4, t: "glass", dur: 10, fl: 1.5, a: 16 },
    { x: 98, y: 64, s: 50, d: 1.1, t: "glass", dur: 16, fl: 0.3, a: 26 },
    { x: 30, y: 60, s: 20, d: 0.3, t: "violet", dur: 10, fl: 2.2, a: 14 },
  ],
  section: [
    { x: 3, y: 18, s: 50, d: 1.1, t: "pearl", dur: 18, fl: 0, a: 30 },
    { x: 9, y: 80, s: 30, d: 0.7, t: "violet", dur: 13, fl: 1.5, a: 22 },
    { x: 97, y: 22, s: 40, d: 0.9, t: "pink", dur: 15, fl: 0.8, a: 26 },
    { x: 93, y: 84, s: 58, d: 1.3, t: "pearl", dur: 19, fl: 2.2, a: 32 },
    { x: 99, y: 56, s: 22, d: 0.4, t: "teal", dur: 11, fl: 1.1, a: 18 },
    { x: 6, y: 50, s: 24, d: 0.5, t: "pearl", dur: 12, fl: 2.0, a: 18 },
    { x: 1, y: 96, s: 40, d: 0.9, t: "pearl", dur: 15, fl: 0.4, a: 22 },
    { x: 101, y: 4, s: 30, d: 0.6, t: "violet", dur: 13, fl: 1.8, a: 20 },
  ],
  cta: [
    { x: 58, y: 20, s: 46, d: 1.0, t: "glass", dur: 15, fl: 0, a: 22 },
    { x: 72, y: 78, s: 34, d: 0.7, t: "glass", dur: 13, fl: 1.2, a: 18 },
    { x: 44, y: 82, s: 24, d: 0.5, t: "glass", dur: 11, fl: 2.0, a: 16 },
    { x: 96, y: 18, s: 30, d: 0.6, t: "glass", dur: 12, fl: 0.6, a: 18 },
    { x: 90, y: 86, s: 52, d: 1.1, t: "glass", dur: 17, fl: 1.7, a: 22 },
    { x: 3, y: 12, s: 28, d: 0.5, t: "glass", dur: 12, fl: 2.5, a: 16 },
  ],
  welcome: [
    { x: 58, y: 26, s: 56, d: 1.0, t: "glass", dur: 14, fl: 0, a: 18 },
    { x: 70, y: 76, s: 38, d: 0.7, t: "glass", dur: 12, fl: 1.2, a: 16 },
    { x: 50, y: 74, s: 26, d: 0.5, t: "glass", dur: 10, fl: 2.0, a: 14 },
    { x: 77, y: 18, s: 30, d: 0.6, t: "glass", dur: 11, fl: 0.6, a: 14 },
    { x: 64, y: 50, s: 20, d: 0.4, t: "glass", dur: 9, fl: 2.6, a: 12 },
    { x: 96, y: 86, s: 34, d: 0.7, t: "glass", dur: 13, fl: 1.7, a: 14 },
  ],
};

function Cube({ c }) {
  const half = c.s / 2;
  const faces = ["front", "back", "right", "left", "top", "bottom"];
  return (
    <div
      className="cube-anchor"
      style={{ left: `${c.x}%`, top: `${c.y}%`, "--d": c.d, "--fl": `${c.fl}s`, "--amp": `${c.a || 24}px` }}
    >
      <div className="cube-float">
        <div className="cube-tilt">
          <div className={`cube3d tint-${c.t}`} style={{ width: c.s, height: c.s, "--half": `${half}px`, "--dur": `${c.dur}s` }}>
            {faces.map((f) => (
              <span key={f} className={`face ${f}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="cube-shadow" style={{ width: c.s * 1.1, marginTop: c.s * 0.9 }} />
    </div>
  );
}

function Constellation({ dark }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let frame;
    let visible = true;
    const pts = [];
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const target = Math.min(170, Math.round((w * h) / 7000));
      while (pts.length < target) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35 });
      pts.length = Math.min(pts.length, target);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    const line = dark ? "199, 182, 255" : "108, 71, 255";
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduced) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      }
      const max = 175;
      for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < max) {
            ctx.strokeStyle = `rgba(${line}, ${(1 - d / max) * (dark ? 0.5 : 0.36)})`;
            ctx.lineWidth = 1.15;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = dark ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.95)";
        ctx.shadowColor = `rgba(${line}, 0.9)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, [dark]);
  return <canvas ref={ref} className="constellation" aria-hidden="true" />;
}

export default function Cubes3D({ preset = "hero", network: _network = true, className = "" }) {
  const network = true; // network lines are shown with every cube scene
  const sceneRef = useRef(null);
  const state = useRef({ mx: 0, my: 0, sy: 0 });
  const dark = preset === "dark";
  const cubes = PRESETS[preset];

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const step = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      state.current.mx = cx;
      state.current.my = cy;
      scene.style.setProperty("--mx", cx.toFixed(3));
      scene.style.setProperty("--my", cy.toFixed(3));
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    const onScroll = () => {
      const r = scene.getBoundingClientRect();
      const sy = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      state.current.sy = sy;
      scene.style.setProperty("--sy", sy.toFixed(3));
    };
    onScroll();
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={sceneRef} className={`cube-scene ${dark ? "dark" : ""} ${className}`} aria-hidden="true">
      {network && <Constellation dark={dark || preset === "cta" || preset === "welcome"} />}
      {cubes.map((c, i) => (
        <Cube key={i} c={c} />
      ))}
    </div>
  );
}
