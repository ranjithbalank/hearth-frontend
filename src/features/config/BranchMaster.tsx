import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { CsvImport } from "../../design/CsvImport";
import { useToast } from "../../design/Toast";
import { Card, PageHeader } from "../../design/ui";
import { api } from "../../lib/api";
import { gstin as gstinFilter } from "../../lib/inputs";
import type { Branch } from "../../lib/types";

const STATUS_TONE: Record<Branch["status"], string> = {
  onboarding: "bg-amber-50 text-amber-600",
  active: "bg-pine-50 text-pine",
  closed: "bg-hairline text-muted",
};

export function BranchMaster() {
  const qc = useQueryClient();
  const toast = useToast();
  const empty = {
    name: "", code: "", city: "", state: "", gstin: "",
    edition: "both" as Branch["edition"], invoice_prefix: "",
  };
  const [f, setF] = useState(empty);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/auth/branches/")).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/auth/branches/", {
        ...f,
        code: f.code.toUpperCase(),
        hms: f.edition !== "restaurant",
        restaurant: f.edition !== "hotel",
        banquets: f.edition !== "restaurant",
        rms: f.edition !== "restaurant",
      })).data,
    onSuccess: () => {
      setF(empty);
      toast("Branch added");
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (e: any) => toast(e?.response?.data?.code?.[0] ?? e?.response?.data?.detail ?? "Could not add branch — the code may already exist", "error"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Branch["status"] }) =>
      (await api.patch(`/auth/branches/${id}/`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [ef, setEf] = useState(empty);
  function startEdit(b: Branch) {
    setEditingId(b.id);
    setEf({ name: b.name, code: b.code, city: b.city ?? "", state: b.state ?? "", gstin: b.gstin ?? "", edition: b.edition, invoice_prefix: b.invoice_prefix ?? "" });
  }
  const saveEdit = useMutation({
    mutationFn: async (id: number) =>
      (await api.patch(`/auth/branches/${id}/`, {
        name: ef.name, code: ef.code.toUpperCase(), city: ef.city, state: ef.state, gstin: ef.gstin,
        edition: ef.edition, invoice_prefix: ef.invoice_prefix,
        hms: ef.edition !== "restaurant", restaurant: ef.edition !== "hotel",
        banquets: ef.edition !== "restaurant", rms: ef.edition !== "restaurant",
      })).data,
    onSuccess: () => { setEditingId(null); toast("Branch updated"); qc.invalidateQueries({ queryKey: ["branches"] }); },
    onError: (e: any) => toast(e?.response?.data?.code?.[0] ?? e?.response?.data?.detail ?? "Could not save — the code may already exist", "error"),
  });

  return (
    <div>
      <PageHeader title="Branch Master" subtitle="The group's locations — each with its own address, GSTIN and edition" />

      <CsvImport path="/auth/branches/import/" templateFilename="branches-template.csv"
        noun="branch" invalidate={["branches"]}
        hint="Onboarding many branches? Download the format, fill it in Excel, and upload once." />

      <Card className="mb-4">
        <div className="font-semibold mb-3">Add branch</div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <input className="input" placeholder="Name (e.g. Hearth Grand — Downtown)" value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input font-mono" placeholder="Code (e.g. DTN)" value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) })} />
          <input className="input" placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <input className="input" placeholder="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
          <input className="input font-mono" placeholder="GSTIN" value={f.gstin}
            onChange={(e) => setF({ ...f, gstin: gstinFilter(e.target.value) })} />
          <select className="input" value={f.edition} onChange={(e) => setF({ ...f, edition: e.target.value as Branch["edition"] })}>
            <option value="both">Hotel + Restaurant</option>
            <option value="hotel">Hotel only</option>
            <option value="restaurant">Restaurant only</option>
          </select>
          <input className="input font-mono" placeholder="Invoice prefix (e.g. DTN-)" value={f.invoice_prefix}
            onChange={(e) => setF({ ...f, invoice_prefix: e.target.value.toUpperCase().slice(0, 10) })} />
        </div>
        <button className="btn-primary mt-1" disabled={!f.name || !f.code || create.isPending} onClick={() => create.mutate()}>
          Add branch
        </button>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">City / State</th>
              <th className="text-left px-4 py-3">GSTIN</th>
              <th className="text-left px-4 py-3">Invoice prefix</th>
              <th className="text-left px-4 py-3">Edition</th>
              <th className="text-right px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {branches?.map((b) => {
              const editing = editingId === b.id;
              return (
                <tr key={b.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs">
                    {editing ? (
                      <input className="input py-1 text-xs font-mono w-20" value={ef.code}
                        onChange={(e) => setEf({ ...ef, code: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) })} />
                    ) : b.code}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {editing ? <input className="input py-1 text-xs w-full" value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} /> : b.name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {editing ? (
                      <div className="flex gap-1">
                        <input className="input py-1 text-xs w-20" placeholder="City" value={ef.city} onChange={(e) => setEf({ ...ef, city: e.target.value })} />
                        <input className="input py-1 text-xs w-20" placeholder="State" value={ef.state} onChange={(e) => setEf({ ...ef, state: e.target.value })} />
                      </div>
                    ) : ([b.city, b.state].filter(Boolean).join(", ") || "—")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {editing ? (
                      <input className="input py-1 text-xs font-mono w-32" value={ef.gstin} onChange={(e) => setEf({ ...ef, gstin: gstinFilter(e.target.value) })} />
                    ) : (b.gstin || "—")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {editing ? (
                      <input className="input py-1 text-xs font-mono w-20" value={ef.invoice_prefix}
                        onChange={(e) => setEf({ ...ef, invoice_prefix: e.target.value.toUpperCase().slice(0, 10) })} />
                    ) : (b.invoice_prefix || "—")}
                  </td>
                  <td className="px-4 py-3 text-muted capitalize">
                    {editing ? (
                      <select className="input py-1 text-xs" value={ef.edition} onChange={(e) => setEf({ ...ef, edition: e.target.value as Branch["edition"] })}>
                        <option value="both">Hotel + Restaurant</option>
                        <option value="hotel">Hotel only</option>
                        <option value="restaurant">Restaurant only</option>
                      </select>
                    ) : b.edition}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      className={`pill border-0 ${STATUS_TONE[b.status]}`}
                      value={b.status}
                      onChange={(e) => setStatus.mutate({ id: b.id, status: e.target.value as Branch["status"] })}
                    >
                      <option value="onboarding">Onboarding</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editing ? (
                      <>
                        <button className="btn-ghost text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => setEditingId(null)}>Cancel</button>
                        <button className="btn-primary text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => saveEdit.mutate(b.id)}>Save</button>
                      </>
                    ) : (
                      <button className="btn-ghost text-xs py-1 px-2" onClick={() => startEdit(b)}>Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {branches?.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No branches yet — add the first one above.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
