import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Card } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { CURRENCIES } from "../../lib/money";

type MasterItem = { id: number; name: string; active: boolean };
type PaymentMethod = MasterItem & {
  counts_as_cash: boolean; captain_allowed: boolean; builtin: boolean;
};

const apiError = (e: any, fallback: string) =>
  e?.response?.data?.detail ?? e?.response?.data?.name?.[0] ?? fallback;

export function CurrencyPanel() {
  const { property, refreshProperty } = useApp();
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  async function pick(code: string) {
    setSaving(code);
    try {
      await api.patch("/auth/property/", { currency: code });
      await refreshProperty();
      toast(`Currency set to ${code}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <div className="font-semibold mb-1">Currency</div>
      <div className="text-sm text-muted mb-4">
        The property's billing currency — its symbol shows on every amount in the app
        and on printed invoices and bills. One currency per property, no conversion.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CURRENCIES.map((c) => (
          <button key={c.code} onClick={() => pick(c.code)} disabled={saving === c.code}
            className={`text-left rounded-card border p-3 ${property?.currency === c.code ? "border-pine bg-pine-50" : "border-hairline"}`}>
            <div className="font-semibold">{c.symbol} {c.code}</div>
            <div className="text-xs text-muted mt-0.5">{c.name}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** Shared list-master panel: add, rename-free inline list, active toggle,
 *  delete (the API refuses and suggests deactivating when rows reference it). */
function SimpleMasterPanel({ title, subtitle, endpoint, queryKey, placeholder }: {
  title: string; subtitle: string; endpoint: string; queryKey: string; placeholder: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const { data: items } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await api.get<MasterItem[]>(endpoint)).data,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: [queryKey] });
  const create = useMutation({
    mutationFn: async () => (await api.post(endpoint, { name: name.trim() })).data,
    onSuccess: () => { setName(""); toast(`${title.replace(/s$/, "")} added`); invalidate(); },
    onError: (e: any) => toast(apiError(e, "Could not add"), "error"),
  });
  const toggle = useMutation({
    mutationFn: async (it: MasterItem) =>
      (await api.patch(`${endpoint}${it.id}/`, { active: !it.active })).data,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (it: MasterItem) => (await api.delete(`${endpoint}${it.id}/`)).data,
    onSuccess: () => { toast("Removed"); invalidate(); },
    onError: (e: any) => toast(apiError(e, "Could not remove"), "error"),
  });

  return (
    <Card>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-muted mb-3">{subtitle}</div>
      <div className="flex gap-2 mb-4 max-w-md">
        <input className="input flex-1" placeholder={placeholder} value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()} />
        <button className="btn-primary" disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}>Add</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-muted text-xs uppercase">
          <tr><th className="text-left py-2">Name</th><th className="text-right py-2">Status</th><th className="w-16" /></tr>
        </thead>
        <tbody>
          {items?.map((it) => (
            <tr key={it.id} className="border-t border-line">
              <td className={`py-2 font-medium ${it.active ? "" : "text-muted line-through"}`}>{it.name}</td>
              <td className="py-2 text-right">
                <button className={`pill ${it.active ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                  onClick={() => toggle.mutate(it)}>
                  {it.active ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="py-2 text-right">
                <button className="btn-ghost text-xs text-clay" onClick={() => remove.mutate(it)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export const DepartmentsPanel = () => (
  <SimpleMasterPanel
    title="Departments" queryKey="master-departments" endpoint="/masters/departments/"
    placeholder="e.g. Spa"
    subtitle="Used by staff records and material-request indents. Indents for a department
      without its own approver route to GM/MD/Super Admin. Departments already used by
      records can only be deactivated — history stays intact." />
);

export const DesignationsPanel = () => (
  <SimpleMasterPanel
    title="Designations" queryKey="master-designations" endpoint="/masters/designations/"
    placeholder="e.g. Chef de Partie"
    subtitle="Job titles for staff records (the duty roster) — separate from login roles,
      which control what a user may open in this app." />
);

export function PaymentMethodsPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const empty = { name: "", counts_as_cash: false, captain_allowed: true };
  const [f, setF] = useState(empty);
  const { data: methods } = useQuery({
    queryKey: ["master-payment-methods"],
    queryFn: async () => (await api.get<PaymentMethod[]>("/masters/payment-methods/")).data,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["master-payment-methods"] });
  const create = useMutation({
    mutationFn: async () => (await api.post("/masters/payment-methods/", { ...f, name: f.name.trim() })).data,
    onSuccess: () => { setF(empty); toast("Payment method added"); invalidate(); },
    onError: (e: any) => toast(apiError(e, "Could not add"), "error"),
  });
  const patch = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Partial<PaymentMethod>) =>
      (await api.patch(`/masters/payment-methods/${id}/`, body)).data,
    onSuccess: invalidate,
    onError: (e: any) => toast(apiError(e, "Could not update"), "error"),
  });
  const remove = useMutation({
    mutationFn: async (m: PaymentMethod) => (await api.delete(`/masters/payment-methods/${m.id}/`)).data,
    onSuccess: () => { toast("Removed"); invalidate(); },
    onError: (e: any) => toast(apiError(e, "Could not remove"), "error"),
  });

  const Flag = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button className={`pill ${on ? "bg-pine text-white" : "bg-hairline text-muted"}`}
      onClick={onClick} title={label}>
      {on ? "Yes" : "No"}
    </button>
  );

  return (
    <Card>
      <div className="font-semibold mb-1">Payment methods</div>
      <div className="text-sm text-muted mb-3">
        The tenders the POS offers at settle. <b>Cash in drawer</b> — collected amounts are
        expected in the physical drawer at till close. <b>Captains may settle</b> — captains
        can take this tableside; off means cashier-counter only. Cash, UPI and Gateway are
        built-in: their behavior is wired into billing, so they can be switched off but not
        renamed or removed.
      </div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input className="input w-44" placeholder="e.g. Sodexo" value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label className="text-sm flex items-center gap-1.5">
          <input type="checkbox" checked={f.counts_as_cash}
            onChange={(e) => setF({ ...f, counts_as_cash: e.target.checked })} />
          Cash in drawer
        </label>
        <label className="text-sm flex items-center gap-1.5">
          <input type="checkbox" checked={f.captain_allowed}
            onChange={(e) => setF({ ...f, captain_allowed: e.target.checked })} />
          Captains may settle
        </label>
        <button className="btn-primary" disabled={!f.name.trim() || create.isPending}
          onClick={() => create.mutate()}>Add</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-muted text-xs uppercase">
          <tr>
            <th className="text-left py-2">Tender</th>
            <th className="text-center py-2">Cash in drawer</th>
            <th className="text-center py-2">Captains may settle</th>
            <th className="text-right py-2">Status</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {methods?.map((m) => (
            <tr key={m.id} className="border-t border-line">
              <td className={`py-2 font-medium ${m.active ? "" : "text-muted line-through"}`}>
                {m.name}
                {m.builtin && <span className="pill bg-hairline text-muted ml-2 text-[10px]">built-in</span>}
              </td>
              <td className="py-2 text-center">
                <Flag on={m.counts_as_cash} label="Counts toward the drawer at till close"
                  onClick={() => patch.mutate({ id: m.id, counts_as_cash: !m.counts_as_cash })} />
              </td>
              <td className="py-2 text-center">
                <Flag on={m.captain_allowed} label="Captains can settle this tableside"
                  onClick={() => patch.mutate({ id: m.id, captain_allowed: !m.captain_allowed })} />
              </td>
              <td className="py-2 text-right">
                <button className={`pill ${m.active ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                  onClick={() => patch.mutate({ id: m.id, active: !m.active })}>
                  {m.active ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="py-2 text-right">
                {!m.builtin && (
                  <button className="btn-ghost text-xs text-clay" onClick={() => remove.mutate(m)}>Remove</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
