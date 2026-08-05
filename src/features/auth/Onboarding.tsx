import { useEffect, useState, type ReactNode } from "react";

import { Logo } from "../../design/ui";
import { PhoneInput, joinPhone, splitPhone } from "../../design/PhoneInput";
import { api } from "../../lib/api";
import { username as usernameFilter } from "../../lib/inputs";
import { useApp } from "../../lib/app-context";

/** What the licence says this install is, in the owner's language. The customer
 *  never picks this — Hearth provisions it before handover (`manage.py
 *  provision`) — so it appears as a stated fact, not a choice. */
const EDITION_LABEL: Record<string, { title: string; desc: string }> = {
  hotel: {
    title: "Hotel",
    desc: "Rooms, front office, housekeeping, banquets and revenue management.",
  },
  restaurant: {
    title: "Restaurant",
    desc: "POS, menu, tables, kitchen display and online orders.",
  },
  both: {
    title: "Hotel + Restaurant",
    desc: "Everything on one data core — restaurant bills post straight to the room folio.",
  },
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Tamil Nadu",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

interface Pack {
  key: string;
  label: string;
  detail: string;
  note?: string;
  option?: { key: string; label: string; default: number };
}

interface Step {
  key: string;
  label: string;
  hint: string;
  where: string;
  done: boolean;
  required: boolean;
}

interface Checklist {
  steps: Step[];
  done: number;
  total: number;
  pct: number;
  blocking: string[];
  ready_to_operate: boolean;
}

/** First-run onboarding.
 *
 *  This used to be two fields — a name and a pick-your-edition card — after
 *  which the owner landed in an app where every screen was empty. It now walks
 *  the three things that actually have to be true before Hearth is usable:
 *  who you are, where you trade from, and something in your catalogue. The
 *  edition is shown, never chosen (see EDITION_LABEL).
 */
export function Onboarding() {
  const { property } = useApp();
  const needsAdmin = !!property?.needs_admin;
  const [step, setStep] = useState(needsAdmin ? 0 : 1);

  const edition = property?.edition ?? "";
  const licence = EDITION_LABEL[edition];
  const steps = needsAdmin
    ? ["Owner account", "Your business", "Your admin", "Starter data", "Ready"]
    : ["Your business", "Your admin", "Starter data", "Ready"];
  const shown = needsAdmin ? step : step - 1;

  return (
    <div className="min-h-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-ink to-[#1E3A8A] p-6">
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-pine/20 blur-3xl pointer-events-none" />
      <div className="w-full max-w-2xl relative py-8">
        <div className="flex items-center gap-3 mb-6 text-white">
          <Logo size={44} />
          <div className="min-w-0">
            <div className="font-display text-3xl">Welcome to Hearth</div>
            {licence && (
              <div className="text-sm text-white/60">
                Licensed for <span className="text-white font-medium">{licence.title}</span> · {licence.desc}
              </div>
            )}
          </div>
        </div>

        <ol className="flex items-center gap-2 mb-5">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2 min-w-0">
              <span
                className={`h-6 w-6 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold ${
                  i < shown ? "bg-pine text-white"
                    : i === shown ? "bg-white text-ink" : "bg-white/15 text-white/50"
                }`}
              >
                {i < shown ? "✓" : i + 1}
              </span>
              <span className={`text-xs truncate ${i === shown ? "text-white" : "text-white/45"}`}>
                {label}
              </span>
              {i < steps.length - 1 && <span className="w-4 h-px bg-white/20 shrink-0" />}
            </li>
          ))}
        </ol>

        {step === 0 && <AdminStep onDone={() => setStep(1)} />}
        {step === 1 && <BusinessStep onDone={() => setStep(2)} />}
        {step === 2 && <AppointAdminStep onDone={() => setStep(3)} />}
        {step === 3 && <StarterDataStep onDone={() => setStep(4)} />}
        {step === 4 && <ReadyStep />}
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
  const uname = usernameFilter(username);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ready = name.trim() !== "" && uname.length >= 2 && emailOk
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
      <h2 className="font-display text-xl text-ink mb-1">Create your owner account</h2>
      <p className="text-sm text-muted mb-5">
        This is the Super Admin — the only account that can run setup and manage staff.
      </p>
      <div className="grid gap-3">
        <Field label="Full name">
          <input className="input" value={name} autoFocus placeholder="e.g. Meera Rao"
            onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Username" hint="letters, numbers, . _ - · at least 2">
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
    </div>
  );
}

/** Everything the app needs to print a compliant bill on day one. Defaults are
 *  filled in rather than left blank — an owner correcting "INR" is faster than
 *  an owner deciding what a currency field wants. */
function BusinessStep({ onDone }: { onDone: () => void }) {
  const { property, setup } = useApp();
  const existingPhone = splitPhone(property?.phone ?? "", property?.default_country_code);
  const [f, setF] = useState({
    name: property?.name && property.name !== "Hearth Property" ? property.name : "",
    address: property?.address ?? "",
    city: "",
    state: "",
    // Kept as code + national so the country code is a choice, not something
    // the owner has to know to type. It was a bare text input whose own
    // placeholder ("+91 90000 00000") showed a format nothing validated.
    phone_code: existingPhone.code,
    phone: existingPhone.number,
    gstin: property?.gstin ?? "",
    currency: property?.currency || "INR",
    gst_billing_mode: property?.gst_billing_mode || "with_gst",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // GSTIN is optional (composition dealers and small outlets bill without one)
  // but if they type one it should be the real 15-character shape.
  const gstinOk = !f.gstin.trim() || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(f.gstin.trim().toUpperCase());
  const ready = f.name.trim() !== "" && f.city.trim() !== "" && gstinOk;

  async function submit() {
    setErr("");
    setSaving(true);
    try {
      const { phone_code, phone, ...rest } = f;
      await setup({
        ...rest,
        phone: joinPhone(phone_code, phone),
        // Remember the code the owner picked — every phone field in the app
        // offers it first from here on.
        default_country_code: phone_code,
        gstin: f.gstin.trim().toUpperCase(),
        branch_name: f.name.trim(),
      });
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl text-ink mb-1">Your business</h2>
      <p className="text-sm text-muted mb-5">
        This is what prints on every invoice and bill. All of it is editable later in Settings.
      </p>

      <div className="grid gap-3">
        <Field label="Business name">
          <input className="input" value={f.name} autoFocus placeholder="e.g. Seaside Grand"
            onChange={(e) => set("name")(e.target.value)} />
        </Field>
        <Field label="Address">
          <input className="input" value={f.address} placeholder="Street, area"
            onChange={(e) => set("address")(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="City">
            <input className="input" value={f.city} placeholder="Coimbatore"
              onChange={(e) => set("city")(e.target.value)} />
          </Field>
          <Field label="State" hint="GST registration is state-specific">
            <select className="input" value={f.state} onChange={(e) => set("state")(e.target.value)}>
              <option value="">Select a state…</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Phone">
            <PhoneInput
              code={f.phone_code}
              number={f.phone}
              onCode={set("phone_code")}
              onNumber={set("phone")}
              placeholder="90000 00000"
              ariaLabel="Business phone number"
            />
          </Field>
          <Field label="GSTIN" hint="optional">
            <input className={`input ${gstinOk ? "" : "border-clay"}`} value={f.gstin}
              placeholder="29ABCDE1234F1Z5"
              onChange={(e) => set("gstin")(e.target.value.toUpperCase())} />
          </Field>
        </div>
        {!gstinOk && (
          <div className="text-xs text-clay -mt-1">
            That doesn't look like a 15-character GSTIN. Leave it blank if you don't have one yet.
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Currency">
            <input className="input" value={f.currency}
              onChange={(e) => set("currency")(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Billing mode">
            <select className="input" value={f.gst_billing_mode}
              onChange={(e) => set("gst_billing_mode")(e.target.value)}>
              <option value="with_gst">Tax invoice (with GST)</option>
              <option value="without_gst">Bill of supply (no GST)</option>
            </select>
          </Field>
        </div>
      </div>

      {err && <div className="text-sm text-clay mt-3">{err}</div>}
      <button className="btn-primary w-full mt-6" onClick={submit} disabled={!ready || saving}>
        {saving ? "Saving…" : "Continue →"}
      </button>
      <p className="text-xs text-muted mt-3 text-center">
        This also opens your first location. Add more branches later in Branch Master.
      </p>
    </div>
  );
}

/** Appoint the Admin.
 *
 *  The owner account exists to own the property, not to run it day to day —
 *  and on a real install the person doing the setup usually isn't the person
 *  who will be adding staff every week. So the chain the rest of Hearth
 *  enforces (owner → admin → everyone else) is offered here, at the one moment
 *  the owner is definitely signed in. Skippable: the setup checklist keeps
 *  asking until it's done, and nobody should be blocked from looking around.
 */
function AppointAdminStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  // Roles are Role Master rows, not a fixed list — a property can rename or
  // retire any of them. This step used to offer five hardcoded names, so it
  // could hand out a role that no longer existed. Same endpoint Settings uses.
  const [roles, setRoles] = useState<{ role: string; modules: string[] | "*" }[]>([]);

  useEffect(() => {
    api.get<{ role: string; modules: string[] | "*" }[]>("/auth/users/assignable-roles/")
      .then(({ data }) => {
        setRoles(data);
        if (data.length && !data.some((r) => r.role === "Admin")) setRole(data[0].role);
      })
      .catch(() => setRoles([]));
  }, []);

  const uname = usernameFilter(username);
  // Optional, but strongly wanted: password reset is delivered to it, so an
  // admin created without one has no way back into their own account.
  const emailOk = !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ready = uname.length >= 2 && password.length >= 8 && emailOk;
  const first = name.trim().split(" ")[0] ?? "";
  const last = name.trim().split(" ").slice(1).join(" ");

  async function submit() {
    setErr("");
    setSaving(true);
    try {
      await api.post("/auth/users/", {
        username: uname, first_name: first, last_name: last, role, password,
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      onDone();
    } catch (e: any) {
      const d = e?.response?.data;
      setErr(d?.detail ?? d?.username?.[0] ?? d?.email?.[0] ?? d?.password?.[0]
        ?? "Couldn't create the account — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl text-ink mb-1">Appoint your admin</h2>
      <p className="text-sm text-muted mb-5">
        Your owner account can do everything, which is exactly why it shouldn't be the one
        signed in at the front desk. Create the person who'll run the property — they can add
        every other login (managers, HR, floor staff) themselves, but never another owner.
      </p>
      <div className="grid gap-3">
        <Field label="Full name">
          <input className="input" value={name} autoFocus placeholder="e.g. Arun Prasad"
            onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Username" hint="letters, numbers, . _ - · at least 2">
          <input className="input" value={username} placeholder="arun"
            onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Email" hint="so they can reset their own password">
          <input className={`input ${emailOk ? "" : "border-clay"}`} type="email" value={email}
            placeholder="arun@yourhotel.com" autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Role">
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.length
                ? roles.map((r) => <option key={r.role} value={r.role}>{r.role}</option>)
                : <option value="Admin">Admin</option>}
            </select>
          </Field>
          <Field label="Password" hint="at least 8 characters">
            <input className="input" type="password" value={password} autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
      </div>

      {err && <div className="text-sm text-clay mt-3">{err}</div>}

      <button className="btn-primary w-full mt-6" onClick={submit} disabled={!ready || saving}>
        {saving ? "Creating…" : "Create and continue →"}
      </button>
      <button className="btn-ghost w-full mt-2 text-sm" onClick={onDone} disabled={saving}>
        Skip — I'll do this later
      </button>
      <p className="text-xs text-muted mt-3 text-center">
        You can add anyone else later from Settings → Users &amp; Roles.
      </p>
    </div>
  );
}

/** The step that stops the app being empty. Packs are ordinary editable data,
 *  so "apply then edit" and "type it all yourself" end up in the same place —
 *  nobody evaluates a POS by entering two hundred dishes first. */
function StarterDataStep({ onDone }: { onDone: () => void }) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/setup/checklist/");
        setPacks(data.packs);
        // Nothing ticked by default. These used to arrive pre-selected on the
        // reasoning that opting out is one click — but the owner who clicks
        // straight through then finds twenty rooms and a menu they never
        // entered sitting in their brand-new property, and can't tell what's
        // theirs. Sample data has to be asked for.
        const n: Record<string, number> = {};
        for (const p of data.packs as Pack[]) {
          if (p.option) n[p.option.key] = p.option.default;
        }
        setChosen({});
        setCounts(n);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function pick(key: string) {
    setChosen((p) => {
      const next = { ...p, [key]: !p[key] };
      // The two menus are alternatives, not a stack — picking one drops the other.
      if (!p[key] && key === "menu_south_indian") next.menu_multicuisine = false;
      if (!p[key] && key === "menu_multicuisine") next.menu_south_indian = false;
      return next;
    });
  }

  async function apply() {
    setErr("");
    setSaving(true);
    try {
      const keys = Object.keys(chosen).filter((k) => chosen[k]);
      if (keys.length) {
        await api.post("/auth/setup/starter-packs/", { packs: keys, options: counts });
      }
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Couldn't apply the starter data.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card p-6 text-sm text-muted">Loading starter data…</div>;

  const anyChosen = Object.values(chosen).some(Boolean);

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl text-ink mb-1">Starter data <span className="text-sm font-normal text-muted">· optional</span></h2>
      <p className="text-sm text-muted mb-5">
        Sample rooms, dishes and tables to try Hearth with before you enter your own. Tick
        anything you'd like filled in — it's ordinary data you can rename, reprice or delete.
        Skip this and you start empty, which is what most properties want.
      </p>

      <div className="grid gap-2">
        {packs.map((p) => (
          <div key={p.key}
            className={`rounded-card border p-3 transition-colors ${
              chosen[p.key] ? "border-pine bg-pine-50" : "border-hairline"}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-1 accent-pine" checked={!!chosen[p.key]}
                onChange={() => pick(p.key)} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink text-sm">{p.label}</span>
                <span className="block text-sm text-body mt-0.5">{p.detail}</span>
                {p.note && <span className="block text-xs text-muted mt-1">{p.note}</span>}
              </span>
            </label>
            {p.option && chosen[p.key] && (
              <div className="flex items-center gap-2 mt-2 pl-7">
                <span className="text-xs text-muted">{p.option.label}</span>
                <input type="number" min={1} max={500} className="input w-24 py-1"
                  value={counts[p.option.key] ?? p.option.default}
                  onChange={(e) => setCounts((c) => ({
                    ...c, [p.option!.key]: Number(e.target.value) }))} />
              </div>
            )}
          </div>
        ))}
      </div>

      {err && <div className="text-sm text-clay mt-3">{err}</div>}
      <button className="btn-primary w-full mt-6" onClick={apply} disabled={saving}>
        {saving ? "Setting up…" : anyChosen ? "Apply and continue →" : "Skip for now →"}
      </button>
      <p className="text-xs text-muted mt-3 text-center">
        Already have a spreadsheet? You can import menus, rooms and tables in bulk from Settings.
      </p>
    </div>
  );
}

/** Progress, not a gate. The owner leaves onboarding the moment the minimum is
 *  met and finishes the rest from inside the app. */
function ReadyStep() {
  const { refreshProperty } = useApp();
  const [list, setList] = useState<Checklist | null>(null);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    api.get("/auth/setup/checklist/").then(({ data }) => setList(data.checklist));
  }, []);

  async function enter() {
    setEntering(true);
    await refreshProperty();
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl text-ink mb-1">You're set up</h2>
      <p className="text-sm text-muted mb-5">
        {list?.ready_to_operate
          ? "Everything essential is in place — you can start taking business now."
          : "You can start using Hearth now and finish the rest as you go."}
      </p>

      {list && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-2 rounded-full bg-hairline overflow-hidden">
              <div className="h-full bg-pine transition-all" style={{ width: `${list.pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-ink tabular-nums">
              {list.done}/{list.total}
            </span>
          </div>

          <ul className="grid gap-1.5">
            {list.steps.map((s) => (
              <li key={s.key} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full grid place-items-center text-[10px] ${
                  s.done ? "bg-pine text-white" : "bg-hairline text-muted"}`}>
                  {s.done ? "✓" : ""}
                </span>
                <span className="min-w-0">
                  <span className={s.done ? "text-muted line-through" : "text-ink font-medium"}>
                    {s.label}
                  </span>
                  {!s.done && (
                    <>
                      {s.required && <span className="ml-2 text-[10px] uppercase tracking-wide text-clay font-semibold">needed</span>}
                      <span className="block text-xs text-muted">{s.hint}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="btn-primary w-full mt-6" onClick={enter} disabled={entering}>
        {entering ? "Opening Hearth…" : "Start using Hearth →"}
      </button>
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
