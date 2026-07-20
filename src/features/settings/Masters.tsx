import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Card } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { CURRENCIES } from "../../lib/money";
import type { KitchenStation } from "../../lib/types";

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

export function KitchenStationsPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: "", mode: "kds" as "kds" | "print" });
  const { data: stations } = useQuery({
    queryKey: ["master-kitchen-stations"],
    queryFn: async () => (await api.get<KitchenStation[]>("/masters/kitchen-stations/")).data,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["master-kitchen-stations"] });
  const create = useMutation({
    mutationFn: async () => (await api.post("/masters/kitchen-stations/", { ...f, name: f.name.trim() })).data,
    onSuccess: () => { setF({ name: "", mode: "kds" }); toast("Station added"); invalidate(); },
    onError: (e: any) => toast(apiError(e, "Could not add"), "error"),
  });
  const patch = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Partial<KitchenStation>) =>
      (await api.patch(`/masters/kitchen-stations/${id}/`, body)).data,
    onSuccess: invalidate,
    onError: (e: any) => toast(apiError(e, "Could not update"), "error"),
  });
  const remove = useMutation({
    mutationFn: async (s: KitchenStation) => (await api.delete(`/masters/kitchen-stations/${s.id}/`)).data,
    onSuccess: () => { toast("Removed"); invalidate(); },
    onError: (e: any) => toast(apiError(e, "Could not remove"), "error"),
  });

  return (
    <Card>
      <div className="font-semibold mb-1">Kitchen stations</div>
      <div className="text-sm text-muted mb-3">
        Which section a menu item cooks in — Grill, Chinese, Indian, Tandoor, the Bar, however
        many an outlet needs. <b>Kitchen Display</b> puts the ticket on the live KDS board same as
        today. <b>Print only</b> is for a section that doesn't use a screen at all — its ticket
        prints automatically the moment it's fired and never appears on the KDS or the floor's
        ready strip. The Bar station is built in (it's what feeds Bar POS's own menu) and can't be
        renamed or removed, only deactivated.
      </div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input className="input w-44" placeholder="e.g. Grill" value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && f.name.trim() && create.mutate()} />
        <select className="input w-44" value={f.mode}
          onChange={(e) => setF({ ...f, mode: e.target.value as "kds" | "print" })}>
          <option value="kds">Kitchen Display</option>
          <option value="print">Print only</option>
        </select>
        <button className="btn-primary" disabled={!f.name.trim() || create.isPending}
          onClick={() => create.mutate()}>Add</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-muted text-xs uppercase">
          <tr>
            <th className="text-left py-2">Station</th>
            <th className="text-left py-2">Mode</th>
            <th className="text-right py-2">Status</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {stations?.map((s) => (
            <tr key={s.id} className="border-t border-line">
              <td className={`py-2 font-medium ${s.active ? "" : "text-muted line-through"}`}>
                {s.name}
                {s.is_bar && <span className="pill bg-hairline text-muted ml-2 text-[10px]">bar · built-in</span>}
              </td>
              <td className="py-2">
                <select className="input py-1 text-xs !w-36" value={s.mode}
                  onChange={(e) => patch.mutate({ id: s.id, mode: e.target.value as "kds" | "print" })}>
                  <option value="kds">Kitchen Display</option>
                  <option value="print">Print only</option>
                </select>
              </td>
              <td className="py-2 text-right">
                <button className={`pill ${s.active ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                  onClick={() => patch.mutate({ id: s.id, active: !s.active })}>
                  {s.active ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="py-2 text-right">
                {!s.is_bar && (
                  <button className="btn-ghost text-xs text-clay" onClick={() => remove.mutate(s)}>Remove</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

interface ChecklistMasterItem { id: number; label: string; sort_order: number; active: boolean }

export function ChecklistItemsPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ label: "", sort_order: "0" });
  const { data: items } = useQuery({
    queryKey: ["hk-checklist-items"],
    queryFn: async () => (await api.get<ChecklistMasterItem[]>("/housekeeping/checklist-items/")).data,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hk-checklist-items"] });
  const checklistError = (e: any, fallback: string) =>
    e?.response?.data?.detail ?? e?.response?.data?.label?.[0] ?? fallback;
  const create = useMutation({
    mutationFn: async () => (await api.post("/housekeeping/checklist-items/", {
      label: f.label.trim(), sort_order: Number(f.sort_order) || 0,
    })).data,
    onSuccess: () => { setF({ label: "", sort_order: "0" }); toast("Checklist item added"); invalidate(); },
    onError: (e: any) => toast(checklistError(e, "Could not add"), "error"),
  });
  const patch = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Partial<ChecklistMasterItem>) =>
      (await api.patch(`/housekeeping/checklist-items/${id}/`, body)).data,
    onSuccess: invalidate,
    onError: (e: any) => toast(checklistError(e, "Could not update"), "error"),
  });
  const remove = useMutation({
    mutationFn: async (c: ChecklistMasterItem) => (await api.delete(`/housekeeping/checklist-items/${c.id}/`)).data,
    onSuccess: () => { toast("Removed"); invalidate(); },
    onError: (e: any) => toast(checklistError(e, "Could not remove"), "error"),
  });

  return (
    <Card>
      <div className="font-semibold mb-1">Cleaning checklist</div>
      <div className="text-sm text-muted mb-3">
        The default room-cleaning checklist — snapshotted onto every housekeeping task when it's
        assigned, so editing this list later never rewrites a task already in progress.
      </div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input className="input w-64" placeholder="e.g. Restock amenities" value={f.label}
          onChange={(e) => setF({ ...f, label: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && f.label.trim() && create.mutate()} />
        <input className="input w-24" type="number" min={0} placeholder="Order" value={f.sort_order}
          onChange={(e) => setF({ ...f, sort_order: e.target.value })} />
        <button className="btn-primary" disabled={!f.label.trim() || create.isPending}
          onClick={() => create.mutate()}>Add</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-muted text-xs uppercase">
          <tr>
            <th className="text-left py-2">Checklist item</th>
            <th className="text-right py-2">Order</th>
            <th className="text-right py-2">Status</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {items?.map((c) => (
            <tr key={c.id} className="border-t border-line">
              <td className={`py-2 font-medium ${c.active ? "" : "text-muted line-through"}`}>{c.label}</td>
              <td className="py-2 text-right">{c.sort_order}</td>
              <td className="py-2 text-right">
                <button className={`pill ${c.active ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                  onClick={() => patch.mutate({ id: c.id, active: !c.active })}>
                  {c.active ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="py-2 text-right">
                <button className="btn-ghost text-xs text-clay" onClick={() => remove.mutate(c)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

interface LinenMasterItem { id: number; name: string; par_per_room: number; active: boolean }

export function LinenItemsPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: "", par_per_room: "1" });
  const { data: items } = useQuery({
    queryKey: ["hk-linen-items"],
    queryFn: async () => (await api.get<LinenMasterItem[]>("/housekeeping/linen-items/")).data,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hk-linen-items"] });
  const create = useMutation({
    mutationFn: async () => (await api.post("/housekeeping/linen-items/", {
      name: f.name.trim(), par_per_room: Number(f.par_per_room) || 1,
    })).data,
    onSuccess: () => { setF({ name: "", par_per_room: "1" }); toast("Linen item added"); invalidate(); },
    onError: (e: any) => toast(apiError(e, "Could not add"), "error"),
  });
  const patch = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Partial<LinenMasterItem>) =>
      (await api.patch(`/housekeeping/linen-items/${id}/`, body)).data,
    onSuccess: invalidate,
    onError: (e: any) => toast(apiError(e, "Could not update"), "error"),
  });
  const remove = useMutation({
    mutationFn: async (l: LinenMasterItem) => (await api.delete(`/housekeeping/linen-items/${l.id}/`)).data,
    onSuccess: () => { toast("Removed"); invalidate(); },
    onError: (e: any) => toast(apiError(e, "Could not remove"), "error"),
  });

  return (
    <Card>
      <div className="font-semibold mb-1">Linen items</div>
      <div className="text-sm text-muted mb-3">
        Par quantity per room turn — shown as the default count when an attendant logs linen
        issued while completing a housekeeping task. This is a log, not a live stock ledger.
      </div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input className="input w-44" placeholder="e.g. Bath towel" value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && f.name.trim() && create.mutate()} />
        <input className="input w-24" type="number" min={0} placeholder="Par/room" value={f.par_per_room}
          onChange={(e) => setF({ ...f, par_per_room: e.target.value })} />
        <button className="btn-primary" disabled={!f.name.trim() || create.isPending}
          onClick={() => create.mutate()}>Add</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-muted text-xs uppercase">
          <tr>
            <th className="text-left py-2">Linen item</th>
            <th className="text-right py-2">Par / room</th>
            <th className="text-right py-2">Status</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {items?.map((l) => (
            <tr key={l.id} className="border-t border-line">
              <td className={`py-2 font-medium ${l.active ? "" : "text-muted line-through"}`}>{l.name}</td>
              <td className="py-2 text-right">{l.par_per_room}</td>
              <td className="py-2 text-right">
                <button className={`pill ${l.active ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                  onClick={() => patch.mutate({ id: l.id, active: !l.active })}>
                  {l.active ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="py-2 text-right">
                <button className="btn-ghost text-xs text-clay" onClick={() => remove.mutate(l)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
