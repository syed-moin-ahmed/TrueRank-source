import { useEffect, useState } from "react";
import { LuArrowRight, LuMenu, LuX } from "react-icons/lu";
import { Button, Logo } from "../components/ui.jsx";
import VerifiedTick from "../components/VerifiedTick.jsx";
import { NavLink, Link } from "../router.jsx";
import { homeFor, useAuth } from "../services/auth.jsx";

const LINKS = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/research", label: "Research" },
  { to: "/about", label: "About" },
];

export default function PublicLayout({ children }) {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="public">
      <header className={`topnav ${scrolled || open ? "scrolled" : ""}`}>
        <div className="container topnav-inner">
          <Logo />
          <nav className="topnav-links" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="topnav-cta">
            {user ? (
              <Button variant="primary" iconRight={LuArrowRight} to={homeFor(user)}>Open dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" to="/login">Log in</Button>
                <Button variant="primary" to="/register">Get started</Button>
              </>
            )}
            <Button variant="ghost" className="btn-icon nav-burger" icon={open ? LuX : LuMenu} aria-label="Menu" onClick={() => setOpen((o) => !o)} />
          </div>
        </div>
        <div className={`mobile-menu ${open ? "open" : ""}`}>
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          {!user && <Link to="/login" onClick={() => setOpen(false)}>Log in</Link>}
        </div>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="stack" style={{ "--gap": "14px" }}>
              <Logo />
              <p className="small" style={{ maxWidth: 340 }}>
                TrueRank: Trust-Aware NLP Framework for Matching Informal Workers to Industry Demand. Skills over
                certificates, trust over paperwork.
              </p>
            </div>
            <div>
              <h4>Explore</h4>
              <div className="stack small" style={{ "--gap": "8px" }}>
                <Link to="/how-it-works">How TrueRank works</Link>
                <Link to="/research">Research results</Link>
                <Link to="/about">About TrueRank</Link>
              </div>
            </div>
            <div>
              <h4>Join</h4>
              <div className="stack small" style={{ "--gap": "8px" }}>
                <Link to="/register?role=requester">I need a worker</Link>
                <Link to="/register?role=worker">I am a skilled worker</Link>
                <Link to="/login">Log in</Link>
              </div>
            </div>
            <div>
              <h4>The method</h4>
              <p className="small">
                NLP preprocessing · TF-IDF · Cosine similarity
                <br />
                Composite Trust Score · Trust-aware ranking
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} TrueRank · Created by <strong className="footer-name">Syed Moin Ahmed</strong> <VerifiedTick size={15} /></span>
            <span>TF-IDF · Cosine similarity · Composite Trust Score · Ranking</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
