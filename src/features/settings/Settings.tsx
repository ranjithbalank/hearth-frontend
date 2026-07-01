import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Card, PageHeader } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import type { Entitlement, Role, User } from "../../lib/types";

const ROLES: Role[] = ["Managing Director", "General Manager", "Front Office", "F&B Cashier", "Housekeeping"];

function UsersPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const empty = { username: "", first_name: "", last_name: "", role: "F&B Cashier" as Role,
    password: "", passcode: "", discount_cap_type: "none", discount_cap_value: "0" };
  const [f, setF] = useState(empty);
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/auth/users/")).data,
  });
  const create = useMutation({
    mutationFn: async () => (await api.post("/auth/users/", f)).data,
    onSuccess: () => { setF(empty); toast("User created"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast(e?.response?.data?.username?.[0] ?? "Could not create user", "error"),
  });
  const toggle = useMutation({
    mutationFn: async (u: User) => (await api.patch(`/auth/users/${u.id}/`, { is_active: !u.is_active })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  return (
    <Card>
      <div className="font-semibold mb-3">Users &amp; roles</div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <input className="input" placeholder="Username" value={f.username} onChange={(e) => set("username", e.target.value)} />
        <input className="input" placeholder="First name" value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />
        <input className="input" placeholder="Last name" value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />
        <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <input className="input" placeholder="Password" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} />
        <input className="input" placeholder="POS passcode" value={f.passcode} onChange={(e) => set("passcode", e.target.value)} />
        <select className="input" value={f.discount_cap_type} onChange={(e) => set("discount_cap_type", e.target.value)}>
          <option value="none">No discount cap</option>
          <option value="percent">% cap</option>
          <option value="fixed">Fixed cap</option>
        </select>
        <input className="input" placeholder="Cap value" value={f.discount_cap_value} onChange={(e) => set("discount_cap_value", e.target.value)} disabled={f.discount_cap_type === "none"} />
      </div>
      <button className="btn-primary mb-4" disabled={!f.username || !f.password || create.isPending} onClick={() => create.mutate()}>
        Add user
      </button>

      <table className="w-full text-sm">
        <thead className="text-muted text-xs uppercase">
          <tr>
            <th className="text-left py-2">Name</th><th className="text-left py-2">Username</th>
            <th className="text-left py-2">Role</th><th className="text-left py-2">Cap</th>
            <th className="text-right py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-2 font-medium">{u.name}</td>
              <td className="py-2 font-mono text-xs">{u.username}</td>
              <td className="py-2">{u.role}</td>
              <td className="py-2 text-muted">
                {u.discount_cap_type === "percent" ? `${Number(u.discount_cap_value)}%`
                  : u.discount_cap_type === "fixed" ? `₹${Number(u.discount_cap_value)}` : "—"}
              </td>
              <td className="py-2 text-right">
                <button
                  className={`pill ${u.is_active ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                  onClick={() => toggle.mutate(u)}
                >
                  {u.is_active ? "Active" : "Inactive"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PropertyPanel() {
  const { property, refreshProperty } = useApp();
  const [f, setF] = useState({
    name: property?.name ?? "", gstin: property?.gstin ?? "",
    address: property?.address ?? "", phone: property?.phone ?? "",
  });
  const [logo, setLogo] = useState(property?.logo ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) return alert("Please use a logo under 400 KB.");
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch("/auth/property/", { ...f, logo });
      await refreshProperty();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4">
      <div className="font-semibold mb-1">Property details &amp; branding</div>
      <div className="text-sm text-muted mb-3">Your hotel's name, logo, GSTIN and address — the name/logo appear in the app and print on invoices.</div>

      <div className="flex items-center gap-4 mb-4">
        <div className="h-16 w-16 rounded-xl bg-cream border border-hairline overflow-hidden flex items-center justify-center">
          {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted">No logo</span>}
        </div>
        <div>
          <label className="btn-outline text-xs cursor-pointer inline-block">
            Upload logo
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </label>
          {logo && <button className="btn-ghost text-xs ml-2" onClick={() => setLogo("")}>Remove</button>}
          <div className="text-xs text-muted mt-1">PNG/JPG, square, under 400 KB.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Business name</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">GSTIN</label>
          <input className="input" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Address</label>
          <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Phone</label>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button className="btn-primary" onClick={save} disabled={saving}>Save details</button>
        {saved && <span className="text-sm text-pine">Saved ✓</span>}
      </div>
    </Card>
  );
}

function MfaPanel() {
  const { user, refreshProperty } = useApp();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(user?.mfa_enabled ?? false);
  const [msg, setMsg] = useState<string | null>(null);

  async function begin() {
    const { data } = await api.post("/auth/mfa/setup/");
    setSecret(data.secret);
    setUri(data.otpauth_uri);
  }
  async function verify() {
    try {
      await api.post("/auth/mfa/verify/", { otp: code });
      setEnabled(true);
      setSecret(null);
      setMsg("MFA enabled — you'll be asked for a code at next sign-in.");
      await refreshProperty();
    } catch {
      setMsg("Invalid code, try again.");
    }
  }
  async function disable() {
    await api.post("/auth/mfa/disable/");
    setEnabled(false);
    setMsg("MFA disabled.");
  }

  return (
    <Card className="mb-4">
      <div className="font-semibold mb-1">Two-factor authentication (TOTP)</div>
      <div className="text-sm text-muted mb-3">
        {enabled ? "MFA is active on your account." : "Protect privileged access with an authenticator app."}
      </div>
      {msg && <div className="text-sm text-pine mb-3">{msg}</div>}
      {enabled ? (
        <button className="btn-outline" onClick={disable}>Disable MFA</button>
      ) : secret ? (
        <div className="space-y-2">
          <div className="text-xs text-muted">Add this secret to your authenticator, then enter a code:</div>
          <code className="block text-sm bg-cream px-3 py-2 rounded-lg break-all">{secret}</code>
          <div className="text-[11px] text-muted break-all">{uri}</div>
          <div className="flex gap-2">
            <input className="input w-40" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn-primary" onClick={verify}>Verify &amp; enable</button>
          </div>
        </div>
      ) : (
        <button className="btn-primary" onClick={begin}>Enable MFA</button>
      )}
    </Card>
  );
}

const FLAGS: { key: keyof Entitlement; label: string; desc: string }[] = [
  { key: "hms", label: "Hotel (HMS)", desc: "Rooms, front office, folio, distribution" },
  { key: "restaurant", label: "Restaurant (POS)", desc: "Menu, tables, orders, KOT" },
  { key: "banquets", label: "Banquets & MICE", desc: "Function space and events" },
  { key: "rms", label: "Revenue Management", desc: "Forecasting and dynamic pricing" },
];

export function Settings() {
  const { property, refreshProperty } = useApp();
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(flag: keyof Entitlement) {
    if (!property) return;
    setSaving(flag);
    try {
      await api.patch("/auth/entitlements/", { [flag]: !property.entitlement[flag] });
      await refreshProperty();
    } finally {
      setSaving(null);
    }
  }

  async function setEdition(edition: string) {
    setSaving(edition);
    try {
      await api.post("/auth/setup/", { edition });
      await refreshProperty();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle={`${property?.name} · edition: ${property?.edition}`} />

      <PropertyPanel />

      <MfaPanel />

      <Card className="mb-4">
        <div className="font-semibold mb-1">Edition</div>
        <div className="text-sm text-muted mb-3">
          Switch the whole property between Hotel, Restaurant, or both — this re-applies the
          module entitlements below.
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "hotel", label: "Hotel only", desc: "Rooms, front office, distribution" },
            { k: "restaurant", label: "Restaurant only", desc: "Standalone POS — no rooms" },
            { k: "both", label: "Hotel + Restaurant", desc: "Everything on one core" },
          ].map((e) => (
            <button key={e.k} onClick={() => setEdition(e.k)} disabled={saving === e.k}
              className={`text-left rounded-card border p-4 ${property?.edition === e.k ? "border-pine bg-pine-50" : "border-hairline"}`}>
              <div className="font-semibold">{e.label}</div>
              <div className="text-sm text-muted mt-1">{e.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="font-semibold mb-1">Edition entitlements</div>
        <div className="text-sm text-muted mb-4">
          Toggling a flag hides its modules across the app (and blocks their APIs).
        </div>
        <div className="grid grid-cols-2 gap-3">
          {FLAGS.map((f) => {
            const on = property?.entitlement[f.key];
            return (
              <button
                key={f.key}
                onClick={() => toggle(f.key)}
                disabled={saving === f.key}
                className={`text-left rounded-card border p-4 ${on ? "border-pine bg-pine-50" : "border-hairline"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{f.label}</span>
                  <span className={`pill ${on ? "bg-pine text-white" : "bg-hairline text-muted"}`}>
                    {on ? "On" : "Off"}
                  </span>
                </div>
                <div className="text-sm text-muted mt-1">{f.desc}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <UsersPanel />
    </div>
  );
}
