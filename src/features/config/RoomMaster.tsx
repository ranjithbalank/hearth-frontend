import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { amount, digits } from "../../lib/inputs";
import { inr } from "../../lib/money";

interface RoomType {
  id: number; code: string; name: string; base_rate: string;
  max_occupancy: number; gst_slab: string;
}

export function RoomMaster() {
  const qc = useQueryClient();
  const empty = { code: "", name: "", base_rate: "", max_occupancy: "2", gst_slab: "12" };
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery({
    queryKey: ["room-types"],
    queryFn: async () => (await api.get<RoomType[]>("/room-types/")).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/room-types/", {
        code: form.code, name: form.name, base_rate: form.base_rate,
        max_occupancy: Number(form.max_occupancy), gst_slab: form.gst_slab,
      })).data,
    onSuccess: () => {
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["room-types"] });
    },
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Room Master" subtitle="Room types, tariffs &amp; GST slabs" />
      <Card className="mb-4">
        <div className="font-semibold mb-3">Add room type</div>
        <div className="grid grid-cols-5 gap-2">
          <input className="input font-mono" placeholder="Code" value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8) })} />
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" inputMode="decimal" placeholder="Base rate" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: amount(e.target.value) })} />
          <input className="input" inputMode="numeric" placeholder="Occupancy" value={form.max_occupancy} onChange={(e) => setForm({ ...form, max_occupancy: digits(e.target.value, 2) })} />
          <select className="input" value={form.gst_slab} onChange={(e) => setForm({ ...form, gst_slab: e.target.value })}>
            <option value="12">12% GST</option>
            <option value="18">18% GST</option>
          </select>
        </div>
        <button className="btn-primary mt-3" disabled={!form.code || !form.name || !form.base_rate || create.isPending} onClick={() => create.mutate()}>
          Add room type
        </button>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-right px-4 py-3">Base rate</th>
              <th className="text-right px-4 py-3">Occupancy</th>
              <th className="text-right px-4 py-3">GST</th>
            </tr>
          </thead>
          <tbody>
            {data.map((rt) => (
              <tr key={rt.id} className="border-t border-line">
                <td className="px-4 py-3 font-mono text-xs">{rt.code}</td>
                <td className="px-4 py-3 font-medium">{rt.name}</td>
                <td className="px-4 py-3 text-right">{inr(rt.base_rate)}</td>
                <td className="px-4 py-3 text-right">{rt.max_occupancy}</td>
                <td className="px-4 py-3 text-right">{Number(rt.gst_slab)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
