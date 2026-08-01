import { useState, type ReactNode } from "react";

import { Logo } from "../../design/ui";
import { useApp } from "../../lib/app-context";

const EDITIONS = [
  {
    key: "hotel",
    title: "Hotel",
    desc: "Full property operations — rooms, front office, revenue, distribution — with the in-house F&B outlet.",
  },
  {
    key: "restaurant",
    title: "Restaurant",
    desc: "Standalone restaurant POS (Petpooja-class). No rooms; bills settle at the outlet.",
  },
  {
    key: "both",
    title: "Hotel + Restaurant",
    desc: "Everything on one data core. Restaurant bills can post straight to the room folio.",
  },
];

/** First-run onboarding. On a fresh install (no owner account) it runs two
 *  steps — create the Super Admin, then set up the property. When an owner
 *  already exists but setup isn't finished, it drops straight to the property
 *  step (the previous behaviour). */
export function Onboarding() {
  const { property } = useApp();
  const twoStep = !!property?.needs_admin;
  const [step, setStep] = useState<1 | 2>(twoStep ? 1 : 2);

  return (
    <div className="min-h-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-ink to-[#1E3A8A] p-6">
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-pine/20 blur-3xl pointer-events-none" />
      <div className="w-full max-w-2xl relative">
        <div className="flex items-center gap-3 mb-8 text-white">
          <Logo size={44} />
          <div>
            <div className="font-display text-3xl">Welcome to Hearth</div>
            <div className="text-sm text-white/50">
              {twoStep ? `Step ${step} of 2 · ` : ""}
              {step === 1 ? "Create your owner account" : "Name your property · choose your edition"}
            </div>
          </div>
        </div>

        {step === 1 ? <AdminStep onDone={() => setStep(2)} /> : <PropertyStep />}
      </div>
    </div>
  );
}

function AdminStep({ onDone }: { onDone: () => void }) {
  const { bootstrapAdmin, login } = useApp();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Usernames follow the app's own convention (like "gm", "superadmin").
  const uname = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ready = name.trim() !== "" && uname.length >= 3 && emailOk
    && password.length >= 8 && password === confirm;

  async function submit() {
    setErr("");
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setSaving(true);
    try {
      await bootstrapAdmin({ name: name.trim(), username: uname, email: email.trim(), password });
      await login(uname, password); // sign in with the credentials we just set
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Couldn't create the account — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="grid gap-3">
        <Field label="Full name">
          <input className="input" value={name} autoFocus placeholder="e.g. Meera Rao"
            onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Username" hint="letters, numbers, . _ - · at least 3">
          <input className="input" value={username} placeholder="meera" autoComplete="username"
            onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={email} placeholder="owner@yourhotel.com"
            autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Password" hint="at least 8 characters">
            <input className="input" type="password" value={password} autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm password">
            <input className="input" type="password" value={confirm} autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
      </div>
      {err && <div className="text-sm text-clay mt-3">{err}</div>}
      <button className="btn-primary w-full mt-6" onClick={submit} disabled={!ready || saving}>
        {saving ? "Creating account…" : "Continue →"}
      </button>
      <p className="text-xs text-muted mt-3 text-center">
        This is the owner (Super Admin) account. You can add staff later in Settings.
      </p>
    </div>
  );
}

function PropertyStep() {
  const { setup } = useApp();
  const [edition, setEdition] = useState("both");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await setup(edition, name.trim() || undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6">
      <label className="block text-xs font-semibold text-muted mb-1">Property name</label>
      <input className="input mb-5" value={name} placeholder="e.g. Seaside Grand"
        onChange={(e) => setName(e.target.value)} />

      <div className="grid gap-3">
        {EDITIONS.map((e) => (
          <button key={e.key} onClick={() => setEdition(e.key)}
            className={`text-left rounded-card border p-4 transition-colors ${
              edition === e.key ? "border-pine bg-pine-50" : "border-hairline hover:bg-cream"}`}>
            <div className="font-semibold text-ink">{e.title}</div>
            <div className="text-sm text-body mt-1">{e.desc}</div>
          </button>
        ))}
      </div>

      <button className="btn-primary w-full mt-6" onClick={submit} disabled={saving}>
        {saving ? "Setting up…" : "Finish setup"}
      </button>
      <p className="text-xs text-muted mt-3 text-center">
        You can reconfigure entitlements later in Settings.
      </p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted mb-1">
        {label}
        {hint && <span className="font-normal opacity-70"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}
