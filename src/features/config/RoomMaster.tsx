import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { CsvImport } from "../../design/CsvImport";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { amount, digits } from "../../lib/inputs";
import { money } from "../../lib/money";

interface RoomType {
  id: number; code: string; name: string; base_rate: string;
  max_occupancy: number; gst_slab: string;
}

export function RoomMaster() {
  const qc = useQueryClient();
  const toast = useToast();
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
      toast("Room type added");
      qc.invalidateQueries({ queryKey: ["room-types"] });
    },
    onError: (e: any) => toast(e?.response?.data?.code?.[0] ?? e?.response?.data?.detail ?? "Could not add room type — the code may already exist", "error"),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(empty);
  function startEdit(rt: RoomType) {
    setEditingId(rt.id);
    setEditForm({ code: rt.code, name: rt.name, base_rate: rt.base_rate, max_occupancy: String(rt.max_occupancy), gst_slab: rt.gst_slab });
  }
  const saveEdit = useMutation({
    mutationFn: async (id: number) =>
      (await api.patch(`/room-types/${id}/`, {
        code: editForm.code, name: editForm.name, base_rate: editForm.base_rate,
        max_occupancy: Number(editForm.max_occupancy), gst_slab: editForm.gst_slab,
      })).data,
    onSuccess: () => { setEditingId(null); toast("Room type updated"); qc.invalidateQueries({ queryKey: ["room-types"] }); },
    onError: (e: any) => toast(e?.response?.data?.code?.[0] ?? e?.response?.data?.detail ?? "Could not save — the code may already exist", "error"),
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Room Master" subtitle="Room types, tariffs &amp; GST slabs" />
      <CsvImport path="/rooms/import/" templateFilename="rooms-template.csv"
        noun="room" invalidate={["room-types", "rooms"]}
        hint="Setting up the whole property? Download the format, list every room with its type and rate, and upload once — room types are created for you." />
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
              <th className="text-right px-4 py-3">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {data.map((rt) => {
              const editing = editingId === rt.id;
              return (
                <tr key={rt.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs">
                    {editing ? (
                      <input className="input py-1 text-xs font-mono w-20" value={editForm.code}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8) })} />
                    ) : rt.code}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {editing ? (
                      <input className="input py-1 text-xs w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    ) : rt.name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing ? (
                      <input className="input py-1 text-xs text-right w-24" inputMode="decimal"
                        value={editForm.base_rate} onChange={(e) => setEditForm({ ...editForm, base_rate: amount(e.target.value) })} />
                    ) : money(rt.base_rate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing ? (
                      <input className="input py-1 text-xs text-right w-16" inputMode="numeric"
                        value={editForm.max_occupancy} onChange={(e) => setEditForm({ ...editForm, max_occupancy: digits(e.target.value, 2) })} />
                    ) : rt.max_occupancy}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing ? (
                      <select className="input py-1 text-xs" value={editForm.gst_slab} onChange={(e) => setEditForm({ ...editForm, gst_slab: e.target.value })}>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                      </select>
                    ) : `${Number(rt.gst_slab)}%`}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editing ? (
                      <>
                        <button className="btn-ghost text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => setEditingId(null)}>Cancel</button>
                        <button className="btn-primary text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => saveEdit.mutate(rt.id)}>Save</button>
                      </>
                    ) : (
                      <button className="btn-ghost text-xs py-1 px-2" onClick={() => startEdit(rt)}>Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
