import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { CsvImport } from "../../design/CsvImport";
import { useToast } from "../../design/Toast";
import { Badge, Card, Field, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { digits, gstin as gstinFilter } from "../../lib/inputs";

interface Supplier {
  id: number; name: string; gstin: string; contact: string;
  payment_terms: string; lead_time_days: number; rating: string;
}

const EMPTY = { name: "", gstin: "", contact: "", payment_terms: "", lead_time_days: "2", rating: "4" };

export function Suppliers() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers-master"],
    queryFn: async () => (await api.get<Supplier[]>("/suppliers/")).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, lead_time_days: Number(form.lead_time_days || 0) };
      return editingId === null
        ? (await api.post("/suppliers/", body)).data
        : (await api.patch(`/suppliers/${editingId}/`, body)).data;
    },
    onSuccess: (s: Supplier) => {
      qc.invalidateQueries({ queryKey: ["suppliers-master"] });
      toast(editingId === null ? `${s.name} added to the supplier list` : `${s.name} updated`);
      setForm({ ...EMPTY });
      setEditingId(null);
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save supplier", "error"),
  });

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name, gstin: s.gstin, contact: s.contact,
      payment_terms: s.payment_terms,
      lead_time_days: String(s.lead_time_days),
      rating: String(Number(s.rating)),
    });
  }

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Goods suppliers · lead time & rating" />

      <CsvImport path="/suppliers/import/" templateFilename="suppliers-template.csv"
        noun="supplier" invalidate={["suppliers-master", "suppliers"]} />

      <Card className="mb-4">
        <div className="font-semibold mb-3">
          {editingId === null ? "Add supplier" : `Edit — ${data.find((s) => s.id === editingId)?.name ?? ""}`}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <Field label="Name">
            <input className="input" value={form.name} placeholder="Fresh Farms"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="GSTIN">
            <input className="input" value={form.gstin} placeholder="29ABCDE1234F1Z5"
              onChange={(e) => setForm({ ...form, gstin: gstinFilter(e.target.value) })} />
          </Field>
          <Field label="Contact">
            <input className="input" value={form.contact} placeholder="Phone / email"
              onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </Field>
          <Field label="Payment terms">
            <input className="input" value={form.payment_terms} placeholder="Net 15"
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
          </Field>
          <Field label="Lead time (days)">
            <input className="input" value={form.lead_time_days} inputMode="numeric"
              onChange={(e) => setForm({ ...form, lead_time_days: digits(e.target.value) })} />
          </Field>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={save.isPending || !form.name.trim()}
              onClick={() => save.mutate()}>
              {editingId === null ? "Add" : "Save"}
            </button>
            {editingId !== null && (
              <button className="btn-ghost" onClick={() => { setEditingId(null); setForm({ ...EMPTY }); }}>
                Cancel
              </button>
            )}
          </div>
        </div>
        {editingId !== null && (
          <div className="mt-3 max-w-[200px]">
            <Field label={`Rating — ${form.rating}★`}>
              <input type="range" min="0" max="5" step="0.5" value={form.rating}
                className="w-full accent-pine"
                onChange={(e) => setForm({ ...form, rating: e.target.value })} />
            </Field>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Supplier</th>
              <th className="text-left px-4 py-3">GSTIN</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">Terms</th>
              <th className="text-right px-4 py-3">Lead time</th>
              <th className="text-right px-4 py-3">Rating</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.gstin || "—"}</td>
                <td className="px-4 py-3 text-muted">{s.contact || "—"}</td>
                <td className="px-4 py-3">{s.payment_terms || "—"}</td>
                <td className="px-4 py-3 text-right">{s.lead_time_days}d</td>
                <td className="px-4 py-3 text-right"><Badge tone="pine">{Number(s.rating).toFixed(1)}★</Badge></td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-ghost text-xs py-1" onClick={() => startEdit(s)}>Edit</button>
                </td>
              </tr>
            ))}
            {!data.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted text-sm">
                No suppliers yet — add the first one above.
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
