import { useState } from "react";
import { LuHouse, LuLock, LuLogIn, LuMail } from "react-icons/lu";
import { Alert, Button, Field, Input } from "../../components/ui.jsx";
import { useDocumentTitle } from "../../hooks/index.js";
import { Link, useQuery, useRouter } from "../../router.jsx";
import { homeFor, useAuth } from "../../services/auth.jsx";
import AuthArt from "./AuthArt.jsx";

export default function Login() {
  useDocumentTitle("Log in");
  const { login } = useAuth();
  const { navigate } = useRouter();
  const { next } = useQuery();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(form.email.trim(), form.password);
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      navigate(safeNext || homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <AuthArt title="Welcome back to TrueRank." text="Skill relevance and behavioural reliability, ranked together — so practical expertise gets discovered." />
      <main className="auth-panel">
        <Link to="/" className="auth-home"><LuHouse /> Back to home</Link>
        <form className="auth-box" onSubmit={submit} noValidate>
          <div>
            <h1 style={{ fontSize: "2rem" }}>Log in</h1>
            <p className="muted mt-8">
              New here? <Link to="/register">Create an account</Link>
            </p>
          </div>
          {error && <Alert type="error">{error}</Alert>}
          <Field label="Email">
            <div className="input-icon">
              <LuMail />
              <Input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </div>
          </Field>
          <Field label="Password">
            <div className="input-icon">
              <LuLock />
              <Input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
          </Field>
          <Button type="submit" variant="primary" size="lg" icon={LuLogIn} loading={loading} className="w-full">Log in</Button>
          <p className="tiny muted center">Administrator accounts are created by the system owner from the command line.</p>
        </form>
      </main>
    </div>
  );
}
