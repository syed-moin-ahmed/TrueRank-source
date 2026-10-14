import { LuQuote, LuShieldCheck, LuSparkles, LuUsers } from "react-icons/lu";
import { Logo } from "../../components/ui.jsx";
import Cubes3D from "../../components/Cubes3D.jsx";

export default function AuthArt({ title, text }) {
  return (
    <aside className="auth-art">
      <div className="blobs">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <Cubes3D preset="dark" />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Logo />
      </div>
      <div className="auth-quote anim-fade-up">
        <LuQuote style={{ width: 36, height: 36, color: "#ff9cc2" }} />
        <h2>{title}</h2>
        <p style={{ color: "var(--ink-300)" }}>{text}</p>
        <div className="row" style={{ "--gap": "10px" }}>
          <span className="chip" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}><LuSparkles /> TF-IDF + cosine</span>
          <span className="chip" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}><LuShieldCheck /> Composite trust</span>
          <span className="chip" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}><LuUsers /> No resume needed</span>
        </div>
      </div>
      <p className="tiny" style={{ position: "relative", zIndex: 1, color: "var(--ink-400)" }}>
        TrueRank · Trust-Aware NLP Framework for Matching Informal Workers to Industry Demand
      </p>
    </aside>
  );
}
