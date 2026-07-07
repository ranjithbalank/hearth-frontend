import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { digits } from "../../lib/inputs";

interface BarTable {
  id: number; name: string; section: string; seats: number; status: string; status_label: string;
}

/** The bar's own seating — a separate master from the restaurant's Table
 *  Master, since the bar runs as its own operation. */
export function BarTableMaster() {
  const qc = useQueryClient();
  const toast = useToast();
  const empty = { name: "", section: "Bar", seats: "4" };
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery({
    queryKey: ["bar-tables-master"],
    queryFn: async () => (await api.get<BarTable[]>("/bar/tables/")).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/bar/tables/", { name: form.name, section: form.section, seats: Number(form.seats) || 1 })).data,
    onSuccess: () => { setForm(empty); toast("Bar table added"); qc.invalidateQueries({ queryKey: ["bar-tables-master"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add bar table", "error"),
  });

  if (isLoading || !data) return <Spinner />;

  const bySection: Record<string, BarTable[]> = {};
  data.forEach((t) => (bySection[t.section] ??= []).push(t));

  return (
    <div>
      <PageHeader title="Bar Table Master" subtitle="The bar's own seating — separate from the restaurant floor" />
      <Card className="mb-4">
        <div className="font-semibold mb-3">Add bar table</div>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" placeholder="Name (e.g. B7)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Seats" value={form.seats} onChange={(e) => setForm({ ...form, seats: digits(e.target.value, 3) })} />
        </div>
        <button className="btn-primary mt-3" disabled={!form.name || create.isPending} onClick={() => create.mutate()}>
          Add bar table
        </button>
      </Card>

      <div className="space-y-5">
        {Object.entries(bySection).map(([sec, list]) => (
          <div key={sec}>
            <div className="text-xs uppercase tracking-wide text-muted mb-2">{sec}</div>
            <div className="grid grid-cols-8 gap-2">
              {list.map((t) => (
                <div key={t.id} className="card p-3 text-center">
                  <div className="font-display text-lg">{t.name}</div>
                  <div className="text-xs text-muted">{t.seats} seats</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!data.length && <div className="text-sm text-muted">No bar tables yet.</div>}
      </div>
    </div>
  );
}
