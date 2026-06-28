import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import type { Entitlement, User } from "../../lib/types";

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

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Settings" subtitle={`${property?.name} · edition: ${property?.edition}`} />

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
