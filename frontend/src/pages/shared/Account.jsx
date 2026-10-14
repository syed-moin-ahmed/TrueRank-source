import { useState } from "react";
import { LuSave, LuUser } from "react-icons/lu";
import { useToast } from "../../components/toast.jsx";
import { Alert, Avatar, Button, Card, CardHeader, Field, GenderPicker, Input, PageHeader } from "../../components/ui.jsx";
import { useDocumentTitle } from "../../hooks/index.js";
import { put } from "../../services/api.js";
import { useAuth } from "../../services/auth.jsx";

export default function Account() {
  useDocumentTitle("Account");
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, city: user.city || "", phone: user.phone || "", gender: user.gender || null });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFields({});
    try {
      const res = await put("/auth/me", { name: form.name.trim(), city: form.city.trim() || null, phone: form.phone.trim() || null, gender: form.gender });
      setUser(res.user);
      toast.success("Account updated");
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Account" subtitle="Your login details. Passwords are stored only as secure hashes." />
      <div className="grid split-aside">
        <Card className="center anim-fade-up">
          <div className="stack" style={{ alignItems: "center", "--gap": "12px" }}>
            <Avatar name={form.name || user.name} gender={form.gender} size="xl" />
            <h3>{user.name}</h3>
            <span className={`role-chip role-${user.role}`}>{user.role}</span>
            <span className="small muted">{user.email}</span>
          </div>
        </Card>
        <Card className="anim-fade-up">
          <CardHeader title="Details" icon={LuUser} />
          <form className="stack" onSubmit={save} noValidate>
            {error && <Alert type="error">{error}</Alert>}
            <Field label="Full name" error={fields.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fields.name} />
            </Field>
            <div className="grid grid-2" style={{ "--gap": "14px" }}>
              <Field label="City" error={fields.city}>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="Phone" error={fields.phone} hint="Shared with a worker only after they accept your job">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fields.phone} />
              </Field>
            </div>
            <div className="field">
              <span className="field-label"><span>Profile picture</span></span>
              <GenderPicker name={form.name} value={form.gender} onChange={(gender) => setForm({ ...form, gender })} />
              <span className="field-hint">Your illustrated profile picture is drawn from your name and this choice.</span>
            </div>
            <Field label="Email" hint="Email cannot be changed">
              <Input value={user.email} disabled />
            </Field>
            <div>
              <Button type="submit" variant="primary" icon={LuSave} loading={saving}>Save changes</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
