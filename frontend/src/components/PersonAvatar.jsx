import { useId } from "react";
import { hashString, resolveGender } from "../utils/gender.js";

/*
 * Illustrated portrait avatar, generated from the person's name + gender.
 * Deterministic: the same name always draws the same face, so lists stay stable.
 */

const SKIN = ["#F6D3B3", "#EDC09A", "#E0AC84", "#C98E66", "#B07452", "#8D5A3B"];
const HAIR = ["#1F1A17", "#2E2420", "#3B2A22", "#4A3426", "#151214", "#5A3E2B"];
const SHIRT = ["#6C5CE7", "#FF6B9D", "#00B894", "#0984E3", "#F39C12", "#E17055", "#00A8A8", "#8E7CF0", "#D63384"];
const BG = [
  ["#E8E4FF", "#C9BFFF"],
  ["#FFE3EE", "#FFC2D8"],
  ["#DDF7EF", "#B4EBDA"],
  ["#DDEEFF", "#B8D9FF"],
  ["#FFF1D6", "#FFDCA0"],
  ["#E3F8FA", "#B9ECF1"],
  ["#F3E8FF", "#DCC4FF"],
];

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + amount))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function MaleHair({ style, color }) {
  switch (style) {
    case 0: // short crop
      return <path d="M29.5 43 C28 25 39 17.5 50.5 17.5 C63 17.5 72.5 25 70.5 43 C68 35 64 30 58 28.5 C50 31.5 39 31 33 35.5 C31 38 30 40.5 29.5 43 Z" fill={color} />;
    case 1: // side part with lift
      return (
        <g fill={color}>
          <path d="M29.5 45 C27 25 40 15.5 53 16.5 C65 17.5 73.5 27 70.5 45 C69 36 66.5 31 62 28.5 C55 32 42 30.5 32 39 Z" />
          <path d="M40 20 C46 14 60 13.5 66 21 C58 18.5 50 19 43 23 Z" opacity=".9" />
        </g>
      );
    case 2: // buzz cut
      return <path d="M31 40 C31 26.5 40 20.5 50 20.5 C60 20.5 69 26.5 69 40 C64.5 31.5 57.5 28 50 28 C42.5 28 35.5 31.5 31 40 Z" fill={color} opacity=".92" />;
    default: // curly top
      return (
        <g fill={color}>
          <path d="M30 42 C29 29 37 22 50 22 C63 22 71 29 70 42 C66 34 59 31 50 31 C41 31 34 34 30 42 Z" />
          {[[35, 26], [42, 21], [50, 19], [58, 21], [65, 26], [38, 31], [62, 31], [46, 25], [54, 25]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={6} />
          ))}
        </g>
      );
  }
}

function FemaleHairBack({ style, color }) {
  if (style === 1) return null; // bun is drawn separately
  if (style === 2) return <path d="M27 40 C25 22 38 15 50 15 C62 15 75 22 73 40 L74 63 C67 67 33 67 26 63 Z" fill={color} />; // bob
  if (style === 3) return <path d="M28 42 C26 22 38 15 50 15 C62 15 74 22 72 42 L73 74 C70 80 64 82 60 80 L58 66 L42 66 L40 80 C36 82 30 80 27 74 Z" fill={color} />; // long, tucked
  return <path d="M27 44 C24 22 38 14 50 14 C62 14 76 22 73 44 L77 86 C66 92 34 92 23 86 Z" fill={color} />; // long straight
}

function FemaleHairFront({ style, color }) {
  switch (style) {
    case 1: // bun
      return (
        <g fill={color}>
          <circle cx="50" cy="14.5" r="9.5" />
          <path d="M29.5 46 C28 26 39 19 50 19 C61 19 72 26 70.5 46 C67 34 59 28 50 28 C41 28 33 34 29.5 46 Z" />
        </g>
      );
    case 2: // bob with fringe
      return <path d="M29 47 C27 26 39 18 50 18 C61 18 73 26 71 47 C69 39 67 35 64 33 C57 36 43 36 36 33 C33 35 30.5 40 29 47 Z" fill={color} />;
    case 3: // middle part
      return <path d="M29.5 48 C28 27 39 18 50 18 C61 18 72 27 70.5 48 C67 35 59 27 50 25 C41 27 33 35 29.5 48 Z" fill={color} />;
    default: // side-swept
      return <path d="M29 48 C27 26 39 17 51 17 C64 17 74 27 71 50 C68 37 63 30 57 27 C51 34 41 36 29 48 Z" fill={color} />;
  }
}

function NeutralHair({ color }) {
  return <path d="M28.5 50 C26 25 39 17 50 17 C61 17 74 25 71.5 50 C69 38 65 31 58 29 C52 33 44 33 38 30 C33 34 30 41 28.5 50 Z" fill={color} />;
}

export default function PersonAvatar({ name, gender }) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  const h = hashString(name);
  const g = resolveGender(name, gender);

  const skin = SKIN[h % SKIN.length];
  const skinShadow = shade(skin, -0.14);
  const hair = HAIR[(h >>> 3) % HAIR.length];
  const shirt = SHIRT[(h >>> 7) % SHIRT.length];
  const [bg1, bg2] = BG[(h >>> 11) % BG.length];
  const hairStyle = (h >>> 15) % 4;
  const beard = g === "male" && (h >>> 18) % 3 === 0;
  const moustache = g === "male" && !beard && (h >>> 20) % 3 === 0;
  const earrings = g === "female" && (h >>> 22) % 2 === 0;
  const smileWide = (h >>> 24) % 2 === 0;

  return (
    <svg viewBox="0 0 100 100" className="person-avatar" aria-hidden="true">
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg1} />
          <stop offset="1" stopColor={bg2} />
        </linearGradient>
        <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(shirt, 0.12)} />
          <stop offset="1" stopColor={shade(shirt, -0.12)} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bg${uid})`} />
      <circle cx="82" cy="18" r="16" fill="#fff" opacity=".35" />

      {g === "female" && <FemaleHairBack style={hairStyle} color={hair} />}

      {/* shoulders */}
      <path d="M12 104 C12 82 29 72.5 50 72.5 C71 72.5 88 82 88 104 Z" fill={`url(#sh${uid})`} />
      {/* neck */}
      <path d="M42.5 58 L57.5 58 L58.5 74 C55 78 45 78 41.5 74 Z" fill={skinShadow} />
      <path d="M41 73 L50 82 L59 73" fill="none" stroke={shade(shirt, -0.3)} strokeWidth="2" strokeLinejoin="round" opacity=".55" />

      {/* ears */}
      <ellipse cx="30" cy="47" rx="4.6" ry="6" fill={skinShadow} />
      <ellipse cx="70" cy="47" rx="4.6" ry="6" fill={skinShadow} />
      {earrings && (
        <g fill="#F5B700">
          <circle cx="30" cy="55" r="2" />
          <circle cx="70" cy="55" r="2" />
        </g>
      )}

      {/* head */}
      <ellipse cx="50" cy="44" rx="20" ry="23" fill={skin} />

      {beard && <path d="M30.5 46 C31 62 40 68 50 68 C60 68 69 62 69.5 46 C67 55 62 58 57 57 C53 56 47 56 43 57 C38 58 33 55 30.5 46 Z" fill={hair} opacity=".9" />}

      {/* hair */}
      {g === "male" && <MaleHair style={hairStyle} color={hair} />}
      {g === "female" && <FemaleHairFront style={hairStyle} color={hair} />}
      {g === "unspecified" && <NeutralHair color={hair} />}

      {/* brows */}
      <g stroke={hair} strokeWidth={g === "male" ? 2.4 : 1.7} strokeLinecap="round" fill="none">
        <path d="M37.5 39.5 Q42 37 46 39" />
        <path d="M54 39 Q58 37 62.5 39.5" />
      </g>
      {/* eyes */}
      <g fill="#2A2530">
        <ellipse cx="42" cy="45.5" rx="2.3" ry="2.6" />
        <ellipse cx="58" cy="45.5" rx="2.3" ry="2.6" />
      </g>
      <circle cx="42.8" cy="44.6" r=".75" fill="#fff" />
      <circle cx="58.8" cy="44.6" r=".75" fill="#fff" />
      {g === "female" && (
        <g stroke="#2A2530" strokeWidth="1.2" strokeLinecap="round">
          <path d="M39.4 43.4 L38.2 42.4" />
          <path d="M60.6 43.4 L61.8 42.4" />
        </g>
      )}
      {/* cheeks */}
      <circle cx="37" cy="53" r="3.6" fill="#FF7A8A" opacity={g === "female" ? 0.28 : 0.14} />
      <circle cx="63" cy="53" r="3.6" fill="#FF7A8A" opacity={g === "female" ? 0.28 : 0.14} />
      {/* nose */}
      <path d="M50 47 Q47.8 52 50.6 53" fill="none" stroke={shade(skin, -0.25)} strokeWidth="1.5" strokeLinecap="round" />
      {moustache && <path d="M43 56.2 Q50 52.6 57 56.2 Q50 55 43 56.2 Z" fill={hair} stroke={hair} strokeWidth="1.6" strokeLinejoin="round" />}
      {/* mouth */}
      {smileWide ? (
        <path d="M44 57.5 Q50 63.5 56 57.5 Z" fill="#8E2F3C" stroke="#8E2F3C" strokeWidth="1" strokeLinejoin="round" />
      ) : (
        <path d="M44.5 57.5 Q50 61.5 55.5 57.5" fill="none" stroke="#8E2F3C" strokeWidth="1.9" strokeLinecap="round" />
      )}
      {g === "female" && !smileWide && <path d="M45.5 58 Q50 60.8 54.5 58" fill="none" stroke="#D9566B" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />}
    </svg>
  );
}
