// Interactive 3D globe of worker profiles, drawn on a <canvas> with a hand-written
// perspective projection (no 3D library). Each point = one worker from the database:
// hue = occupation, brightness/size = trust score. Drag to rotate; it spins on its own.
import { useEffect, useRef, useState } from "react";

const HUES = [262, 330, 170, 38, 210, 140, 15, 290, 190, 50, 240, 355, 100, 25, 275, 160, 315, 200, 75, 225, 5, 125];

function fibonacciSphere(n) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i += 1) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return pts;
}

export default function Network3D({ network, height = 460, onHover }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !network?.points?.length) return undefined;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Group workers by occupation so each trade forms its own cluster on the sphere.
    const order = network.points.map((p, i) => ({ occ: p[0], trust: p[1], i })).sort((a, b) => a.occ - b.occ || b.trust - a.trust);
    const base = fibonacciSphere(order.length);
    const nodes = order.map((p, k) => ({ ...p, pos: base[k] }));

    // Links: connect each node to its nearest neighbour of the same trade (precomputed once).
    const links = [];
    for (let a = 0; a < nodes.length; a += 1) {
      let best = -1;
      let bestD = Infinity;
      for (let b = 0; b < nodes.length; b += 1) {
        if (a === b || nodes[a].occ !== nodes[b].occ) continue;
        const [x1, y1, z1] = nodes[a].pos;
        const [x2, y2, z2] = nodes[b].pos;
        const d = (x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2;
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      if (best > a && bestD < 0.09) links.push([a, best]);
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = wrap.clientWidth;
      h = height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let rotY = 0.6;
    let rotX = -0.35;
    let velY = reduced ? 0 : 0.0035;
    let velX = 0;
    let dragging = false;
    let last = null;
    let mouse = null;
    let visible = true;
    let frame;
    let projected = [];

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);

    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible) return;
      if (!dragging) {
        rotY += velY;
        rotX += velX;
        velX *= 0.95;
        if (!reduced) velY += (0.0035 - velY) * 0.02;
        rotX = Math.max(-1.2, Math.min(1.2, rotX));
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const R = Math.min(w, h) * 0.38;
      const cx = w / 2;
      const cy = h / 2;
      const camera = 2.6;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      projected = nodes.map((n) => {
        const [x0, y0, z0] = n.pos;
        const x1 = x0 * cosY + z0 * sinY;
        const z1 = -x0 * sinY + z0 * cosY;
        const y2 = y0 * cosX - z1 * sinX;
        const z2 = y0 * sinX + z1 * cosX;
        const s = camera / (camera - z2);
        return { n, x: cx + x1 * R * s, y: cy + y2 * R * s, z: z2, s };
      });

      // glow behind the globe
      const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.35);
      g.addColorStop(0, "rgba(108,71,255,0.18)");
      g.addColorStop(1, "rgba(108,71,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // links (back ones faint)
      ctx.lineWidth = 1;
      for (const [a, b] of links) {
        const p = projected[a];
        const q = projected[b];
        const depth = (p.z + q.z) / 2;
        const hue = HUES[p.n.occ % HUES.length];
        ctx.strokeStyle = `hsla(${hue}, 90%, 70%, ${0.06 + Math.max(0, depth + 1) * 0.16})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }

      // nodes, far to near
      const sorted = [...projected].sort((a, b) => a.z - b.z);
      let hit = null;
      for (const p of sorted) {
        const hue = HUES[p.n.occ % HUES.length];
        const front = (p.z + 1) / 2; // 0 back .. 1 front
        const r = (1.4 + p.n.trust * 3.2) * p.s;
        const light = 45 + p.n.trust * 25;
        ctx.fillStyle = `hsla(${hue}, 92%, ${light}%, ${0.25 + front * 0.75})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (p.n.trust > 0.85 && front > 0.55) {
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${0.18 * front})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (mouse && front > 0.45 && (p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2 < (r + 5) ** 2) hit = p;
      }
      if (hit) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, (1.4 + hit.n.trust * 3.2) * hit.s + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      const next = hit ? { occ: network.occupations[hit.n.occ], trust: hit.n.trust, x: hit.x, y: hit.y } : null;
      setHovered((prev) => (prev?.occ === next?.occ && prev?.trust === next?.trust ? prev : next));
    };
    frame = requestAnimationFrame(draw);

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const down = (e) => {
      dragging = true;
      last = pos(e);
      canvas.style.cursor = "grabbing";
    };
    const move = (e) => {
      mouse = pos(e);
      if (!dragging || !last) return;
      const p = mouse;
      velY = (p.x - last.x) * 0.006;
      velX = (p.y - last.y) * 0.006;
      rotY += velY;
      rotX = Math.max(-1.2, Math.min(1.2, rotX + velX));
      last = p;
      if (e.cancelable && e.touches) e.preventDefault();
    };
    const up = () => {
      dragging = false;
      canvas.style.cursor = "grab";
    };
    const leave = () => {
      mouse = null;
      up();
    };
    canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("mouseleave", leave);
    canvas.addEventListener("touchstart", down, { passive: true });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      canvas.removeEventListener("mouseleave", leave);
      canvas.removeEventListener("touchstart", down);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", up);
    };
  }, [network, height]);

  useEffect(() => onHover?.(hovered), [hovered, onHover]);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height }}>
      <canvas ref={canvasRef} style={{ display: "block", cursor: "grab", touchAction: "pan-y" }} aria-label="Interactive 3D network of worker profiles" role="img" />
      {hovered && (
        <div className="globe-tip" style={{ left: hovered.x, top: hovered.y }}>
          <strong>{hovered.occ}</strong>
          <span>Trust {hovered.trust.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

export { HUES };
