import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import type { Entitlement, User } from "../../lib/types";

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

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/auth/users/")).data,
  });

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

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Settings" subtitle={`${property?.name} · edition: ${property?.edition}`} />

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

      <Card>
        <div className="font-semibold mb-3">Users &amp; roles</div>
        <table className="w-full text-sm">
          <thead className="text-muted text-xs uppercase">
            <tr><th className="text-left py-2">Name</th><th className="text-left py-2">Username</th><th className="text-left py-2">Role</th></tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="py-2 font-medium">{u.name}</td>
                <td className="py-2 font-mono text-xs">{u.username}</td>
                <td className="py-2">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
