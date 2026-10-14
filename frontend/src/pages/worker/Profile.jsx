import { useEffect, useState } from "react";
import { LuBadgeCheck, LuBriefcase, LuEye, LuHistory, LuLightbulb, LuMapPin, LuPlus, LuSave, LuShieldCheck, LuTrash2, LuWrench } from "react-icons/lu";
import { useToast } from "../../components/toast.jsx";
import {
  Alert, Button, Card, CardHeader, ChipInput, ErrorState, Field, Input, PageHeader, Select, SkeletonCards, StatusPill, Textarea, Toggle,
} from "../../components/ui.jsx";
import { useApi, useDocumentTitle } from "../../hooks/index.js";
import { useRouter } from "../../router.jsx";
import { post, put } from "../../services/api.js";
import { useAuth } from "../../services/auth.jsx";
import { date } from "../../utils/format.js";

const TRADES = ["Electrician", "Plumber", "Carpenter", "Painter", "AC Technician", "Mason", "Welder", "Tile Installer", "House Cleaner", "CCTV Installer", "Appliance Repair Technician", "Gardener", "Tailor", "Event Decorator"];
const EMPTY = { occupation: "", skills: [], experience_years: "", city: "", languages: [], profile_description: "", work_history: [], is_available: true };

function VerificationCard() {
  const toast = useToast();
  const { data, reload } = useApi("/workers/me/verifications");
  const [method, setMethod] = useState("phone");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = data?.items.some((v) => v.status === "pending");

  const submit = async () => {
    setBusy(true);
    try {
      await post("/workers/me/verifications", { method, reference_note: note.trim() });
      toast.success("Verification requested", "An administrator will review it.");
      setNote("");
      reload();
    } catch (e) {
      toast.error("Could not submit", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Verification (optional)" icon={LuBadgeCheck} tone="green" subtitle="A verified badge is shown to requesters. It is not part of the trust formula." />
      <div className="stack">
        {data?.items.map((v) => (
          <div key={v.id} className="row-between small">
            <span className="strong">{v.method.replace(/_/g, " ")}</span>
            <span className="muted">{date(v.created_at)}</span>
            <StatusPill status={v.status} />
          </div>
        ))}
        {!pending && (
          <>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="phone">Phone number check</option>
                <option value="government_id">Government ID (shown in person)</option>
                <option value="employer_reference">Employer / contractor reference</option>
                <option value="community_reference">Community reference</option>
              </Select>
            </Field>
            <Field label="Reference note" hint="Do NOT type ID numbers here. Write who can confirm your work, e.g. a contractor’s name.">
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Field>
            <div><Button variant="green" icon={LuBadgeCheck} loading={busy} onClick={submit}>Request verification</Button></div>
          </>
        )}
      </div>
    </Card>
  );
}

export default function WorkerProfile() {
  useDocumentTitle("My profile");
  const toast = useToast();
  const { navigate } = useRouter();
  const { refresh, user } = useAuth();
  const { data, error, loading, reload } = useApi("/workers/me");
  const [form, setForm] = useState(EMPTY);
  const [fields, setFields] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const exists = Boolean(data?.profile);

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      setForm({
        occupation: p.occupation,
        skills: p.skills,
        experience_years: String(p.experience_years),
        city: p.city,
        languages: p.languages,
        profile_description: p.profile_description,
        work_history: p.work_history.map((h) => ({ title: h.title, description: h.description, year: h.year ?? "" })),
        is_available: p.is_available,
      });
    } else if (data && !data.profile) {
      setForm((f) => ({ ...f, city: user.city || "" }));
    }
  }, [data, user.city]);

  if (loading && !data) return <SkeletonCards count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setHistory = (i, key, value) => setForm((f) => ({ ...f, work_history: f.work_history.map((h, j) => (j === i ? { ...h, [key]: value } : h)) }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFields({});
    setFormError(null);
    const payload = {
      occupation: form.occupation.trim(),
      skills: form.skills,
      experience_years: form.experience_years === "" ? null : Number(form.experience_years),
      city: form.city.trim(),
      languages: form.languages,
      profile_description: form.profile_description.trim(),
      work_history: form.work_history
        .filter((h) => h.title.trim())
        .map((h) => ({ title: h.title.trim(), description: (h.description || "").trim(), year: h.year === "" || h.year === null ? null : Number(h.year) })),
      is_available: form.is_available,
    };
    try {
      if (exists) {
        await put("/workers/me", payload);
        toast.success("Profile updated", "The TF-IDF index will include your changes in the next search.");
        reload();
      } else {
        await post("/workers/me", payload);
        await refresh();
        toast.success("Profile created", "You can now be matched to service requests.");
        navigate("/worker");
      }
    } catch (err) {
      setFields(err.fields || {});
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const descLen = form.profile_description.trim().length;

  return (
    <>
      <PageHeader
        title={exists ? "My worker profile" : "Create your worker profile"}
        subtitle="Describe your practical skills in your own words. No resume, degree or certificate is required."
        actions={exists && <Button variant="soft" icon={LuEye} to={`/workers/${data.profile.id}`}>Preview public profile</Button>}
      />
      <div className="grid split-main">
        <Card className="anim-fade-up">
          <form onSubmit={save} noValidate>
            {formError && <Alert type="error">{formError}</Alert>}

            <div className="form-section">
              <div>
                <h3><LuBriefcase style={{ display: "inline", width: 18, verticalAlign: -3 }} /> Your trade</h3>
                <p className="muted">What work do you do?</p>
              </div>
              <div className="stack">
                <Field label="Occupation" error={fields.occupation}>
                  <Input list="trades" value={form.occupation} onChange={(e) => set("occupation")(e.target.value)} error={fields.occupation} placeholder="e.g. Electrician" />
                  <datalist id="trades">{TRADES.map((t) => <option key={t} value={t} />)}</datalist>
                </Field>
                <Field label="Years of practical experience" error={fields.experience_years}>
                  <Input type="number" min="0" max="60" step="0.5" value={form.experience_years} onChange={(e) => set("experience_years")(e.target.value)} error={fields.experience_years} />
                </Field>
              </div>
            </div>

            <div className="form-section">
              <div>
                <h3><LuWrench style={{ display: "inline", width: 18, verticalAlign: -3 }} /> Skills</h3>
                <p className="muted">Press Enter or comma after each skill.</p>
              </div>
              <Field error={fields.skills} hint="e.g. Wiring, MCB repair, Electrical maintenance, Motor repair">
                <ChipInput values={form.skills} onChange={set("skills")} placeholder="Type a skill and press Enter" error={fields.skills} />
              </Field>
            </div>

            <div className="form-section">
              <div>
                <h3><LuMapPin style={{ display: "inline", width: 18, verticalAlign: -3 }} /> Location &amp; languages</h3>
              </div>
              <div className="stack">
                <Field label="City" error={fields.city}>
                  <Input value={form.city} onChange={(e) => set("city")(e.target.value)} error={fields.city} placeholder="Bengaluru" />
                </Field>
                <Field label="Languages you speak">
                  <ChipInput values={form.languages} onChange={set("languages")} placeholder="Kannada, Hindi…" tone="sky" />
                </Field>
              </div>
            </div>

            <div className="form-section">
              <div>
                <h3>In your own words</h3>
                <p className="muted">This text is processed by NLP and matched against requests.</p>
              </div>
              <Field label="Describe your work" error={fields.profile_description} right={<span className={`tiny ${descLen < 20 ? "text-red" : "muted"}`}>{descLen}/2000</span>}>
                <Textarea value={form.profile_description} onChange={(e) => set("profile_description")(e.target.value)} maxLength={2000} error={fields.profile_description} placeholder="e.g. I have done house wiring and MCB repair for 5 years in Bengaluru. I also repair motors and do electrical maintenance for shops." />
              </Field>
            </div>

            <div className="form-section">
              <div>
                <h3><LuHistory style={{ display: "inline", width: 18, verticalAlign: -3 }} /> Previous work</h3>
                <p className="muted">Jobs you are proud of. Optional.</p>
              </div>
              <div className="stack">
                {form.work_history.map((h, i) => (
                  <div key={i} className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
                    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 110px auto", "--gap": "10px", alignItems: "end" }}>
                      <Field label="What did you do?" error={fields[`work_history.${i}.title`]}>
                        <Input value={h.title} onChange={(e) => setHistory(i, "title", e.target.value)} placeholder="Rewired a 3-floor house" />
                      </Field>
                      <Field label="Year" error={fields[`work_history.${i}.year`]}>
                        <Input type="number" value={h.year} onChange={(e) => setHistory(i, "year", e.target.value)} placeholder="2024" />
                      </Field>
                      <Button variant="danger" className="btn-icon" icon={LuTrash2} aria-label="Remove" onClick={() => set("work_history")(form.work_history.filter((_, j) => j !== i))} />
                    </div>
                    <div className="mt-8">
                      <Textarea value={h.description} onChange={(e) => setHistory(i, "description", e.target.value)} placeholder="Details (optional)" style={{ minHeight: 60 }} />
                    </div>
                  </div>
                ))}
                <div>
                  <Button variant="soft" icon={LuPlus} onClick={() => set("work_history")([...form.work_history, { title: "", description: "", year: "" }])}>Add previous work</Button>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div>
                <h3>Availability</h3>
              </div>
              <Toggle checked={form.is_available} onChange={set("is_available")} label={form.is_available ? "Available for new jobs" : "Not taking new jobs (hidden from search)"} />
            </div>

            <div className="row" style={{ justifyContent: "flex-end", paddingTop: 10 }}>
              <Button type="submit" variant="primary" size="lg" icon={LuSave} loading={saving}>{exists ? "Save profile" : "Create profile"}</Button>
            </div>
          </form>
        </Card>

        <div className="stack" style={{ "--gap": "22px" }}>
          <Card className="anim-fade-up">
            <CardHeader title="Tips for better matches" icon={LuLightbulb} tone="amber" />
            <ul className="stack small" style={{ "--gap": "8px", paddingLeft: 18, margin: 0, color: "var(--ink-700)" }}>
              <li>Use the words customers use: “leaking pipe”, “circuit breaker”, “wall putty”.</li>
              <li>Mention specific tasks, not only your trade name.</li>
              <li>Matching is by words (TF-IDF), so list related skills separately.</li>
              <li>Your trust score grows with good ratings, completed jobs and peer endorsements.</li>
            </ul>
          </Card>
          {exists && <VerificationCard />}
          {exists && (
            <Card>
              <CardHeader title="Your trust score" icon={LuShieldCheck} tone="amber" />
              <p className="small muted">Editing your profile changes your skill similarity, not your trust score. Trust only changes through real work outcomes.</p>
              <div className="mt-16"><Button variant="soft" to="/worker/trust">Open trust breakdown</Button></div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
