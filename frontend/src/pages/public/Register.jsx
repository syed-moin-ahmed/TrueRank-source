import { useState } from "react";
import { LuArrowLeft, LuArrowRight, LuCheck, LuHammer, LuHouse, LuSearch, LuUserPlus } from "react-icons/lu";
import { Alert, Button, Field, GenderPicker, IconBubble, Input } from "../../components/ui.jsx";
import { useDocumentTitle } from "../../hooks/index.js";
import { Link, useQuery, useRouter } from "../../router.jsx";
import { homeFor, useAuth } from "../../services/auth.jsx";
import AuthArt from "./AuthArt.jsx";

const ROLES = [
  { value: "requester", title: "I am a Service Requester", text: "I need a skilled worker for a job.", icon: LuSearch, tone: "sky" },
  { value: "worker", title: "I am a Skilled Worker", text: "I want to be found for my practical skills.", icon: LuHammer, tone: "amber" },
];

export default function Register() {
  useDocumentTitle("Create account");
  const query = useQuery();
  const { register } = useAuth();
  const { navigate } = useRouter();
  const [role, setRole] = useState(ROLES.some((r) => r.value === query.role) ? query.role : null);
  const [step, setStep] = useState(role ? 2 : 1);
  const [form, setForm] = useState({ name: "", email: "", password: "", city: "", phone: "", gender: null });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        city: form.city.trim() || null,
        phone: form.phone.trim() || null,
        gender: form.gender,
      });
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <AuthArt
        title={role === "worker" ? "Your skills are your resume." : "Find workers by what they can do."}
        text={role === "worker" ? "No certificates or CV needed. Describe your work in your own words and build trust with every job." : "Describe the job in plain language. TrueRank ranks workers by skill similarity and trust."}
      />
      <main className="auth-panel">
        <Link to="/" className="auth-home"><LuHouse /> Back to home</Link>
        {step === 1 ? (
          <div className="auth-box">
            <div>
              <h1 style={{ fontSize: "2rem" }}>Create your account</h1>
              <p className="muted mt-8">First, tell us who you are. Already registered? <Link to="/login">Log in</Link></p>
            </div>
            <div className="role-choice">
              {ROLES.map((r) => (
                <button key={r.value} type="button" className={`role-option ${role === r.value ? "selected" : ""}`} onClick={() => setRole(r.value)}>
                  {role === r.value && <span className="check"><LuCheck /></span>}
                  <IconBubble icon={r.icon} tone={r.tone} />
                  <strong>{r.title}</strong>
                  <span className="small muted">{r.text}</span>
                </button>
              ))}
            </div>
            <Button variant="primary" size="lg" iconRight={LuArrowRight} disabled={!role} onClick={() => setStep(2)}>Continue</Button>
          </div>
        ) : (
          <form className="auth-box" onSubmit={submit} noValidate>
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)} style={{ marginLeft: -12 }}>
                <LuArrowLeft /> Change role
              </button>
              <h1 style={{ fontSize: "2rem", marginTop: 8 }}>{role === "worker" ? "Join as a skilled worker" : "Join as a service requester"}</h1>
              <p className="muted mt-8">
                {role === "worker" ? "Next, you will describe your skills and experience. No resume upload." : "You can start searching for workers right after this."}
              </p>
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <Field label="Full name" error={fields.name}>
              <Input autoComplete="name" value={form.name} onChange={set("name")} error={fields.name} placeholder="e.g. Ramesh Kumar" />
            </Field>
            <Field label="Email" error={fields.email}>
              <Input type="email" autoComplete="email" value={form.email} onChange={set("email")} error={fields.email} placeholder="you@example.com" />
            </Field>
            <Field label="Password" hint="At least 8 characters with letters and numbers" error={fields.password}>
              <Input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={fields.password} />
            </Field>
            <div className="grid grid-2" style={{ "--gap": "14px" }}>
              <Field label="City" error={fields.city}>
                <Input value={form.city} onChange={set("city")} placeholder="Bengaluru" />
              </Field>
              <Field label="Phone (optional)" error={fields.phone}>
                <Input value={form.phone} onChange={set("phone")} error={fields.phone} placeholder="+91…" />
              </Field>
            </div>
            <div className="field">
              <span className="field-label"><span>Profile picture</span></span>
              <GenderPicker name={form.name} value={form.gender} onChange={(gender) => setForm({ ...form, gender })} />
            </div>
            <Button type="submit" variant="primary" size="lg" icon={LuUserPlus} loading={loading}>Create account</Button>
          </form>
        )}
      </main>
    </div>
  );
}
