import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { amount, digits } from "../../lib/inputs";
import type { Branch } from "../../lib/types";

interface Employee {
  id: number; name: string; department: string; role: string; status: string;
  phone: string; monthly_salary: string;
  branch: number | null; branch_name: string | null;
}
interface User { username: string; name: string; role: string }

export function Employees() {
  const qc = useQueryClient();
  const toast = useToast();
  const empty = { name: "", department: "", role: "", phone: "", monthly_salary: "", branch: "" };
  const [f, setF] = useState(empty);

  const { data: staff, isLoading } = useQuery({
    queryKey: ["employees-master"],
    queryFn: async () => (await api.get<Employee[]>("/hr/")).data,
  });
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/auth/users/")).data,
  });
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/auth/branches/")).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/hr/", {
      name: f.name, department: f.department, role: f.role, phone: f.phone,
      monthly_salary: f.monthly_salary || 0, branch: f.branch || null,
    })).data,
    onSuccess: () => {
      setF(empty);
      toast("Employee added");
      qc.invalidateQueries({ queryKey: ["employees-master"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add employee", "error"),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [ef, setEf] = useState(empty);
  function startEdit(e: Employee) {
    setEditingId(e.id);
    setEf({
      name: e.name, department: e.department, role: e.role, phone: e.phone,
      monthly_salary: e.monthly_salary, branch: e.branch ? String(e.branch) : "",
    });
  }
  const saveEdit = useMutation({
    mutationFn: async (id: number) => (await api.patch(`/hr/${id}/`, {
      name: ef.name, department: ef.department, role: ef.role, phone: ef.phone,
      monthly_salary: ef.monthly_salary || 0, branch: ef.branch || null,
    })).data,
    onSuccess: () => { setEditingId(null); toast("Employee updated"); qc.invalidateQueries({ queryKey: ["employees-master"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save changes", "error"),
  });

  if (isLoading || !staff) return <Spinner />;
  const userByName = new Map((users ?? []).map((u) => [u.name, u]));
  const showBranch = (branches?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader title="Employees" subtitle="Staff directory & system access" />

      <Card className="mb-4">
        <div className="font-semibold mb-3">Add employee</div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" placeholder="Department" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
          <input className="input" placeholder="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
          <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: digits(e.target.value, 15) })} />
          <input className="input" inputMode="decimal" placeholder="Monthly salary" value={f.monthly_salary}
            onChange={(e) => setF({ ...f, monthly_salary: amount(e.target.value) })} />
          {showBranch && (
            <select className="input" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>
              <option value="">Branch (defaults to yours)</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <button className="btn-primary mt-1" disabled={!f.name || !f.department || !f.role || create.isPending}
          onClick={() => create.mutate()}>
          Add employee
        </button>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-right px-4 py-3">Monthly salary</th>
              {showBranch && <th className="text-left px-4 py-3">Branch</th>}
              <th className="text-left px-4 py-3">System access</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((e) => {
              const u = userByName.get(e.name);
              const editing = editingId === e.id;
              return (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">
                    {editing ? <input className="input py-1 text-xs w-28" value={ef.name} onChange={(v) => setEf({ ...ef, name: v.target.value })} /> : e.name}
                  </td>
                  <td className="px-4 py-3">
                    {editing ? <input className="input py-1 text-xs w-24" value={ef.department} onChange={(v) => setEf({ ...ef, department: v.target.value })} /> : e.department}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {editing ? <input className="input py-1 text-xs w-24" value={ef.role} onChange={(v) => setEf({ ...ef, role: v.target.value })} /> : e.role}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {editing ? (
                      <input className="input py-1 text-xs w-24" value={ef.phone} onChange={(v) => setEf({ ...ef, phone: digits(v.target.value, 15) })} />
                    ) : (e.phone || "—")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing ? (
                      <input className="input py-1 text-xs text-right w-24" inputMode="decimal"
                        value={ef.monthly_salary} onChange={(v) => setEf({ ...ef, monthly_salary: amount(v.target.value) })} />
                    ) : (Number(e.monthly_salary) ? `₹${Number(e.monthly_salary).toLocaleString("en-IN")}` : "—")}
                  </td>
                  {showBranch && (
                    <td className="px-4 py-3 text-muted">
                      {editing ? (
                        <select className="input py-1 text-xs" value={ef.branch} onChange={(v) => setEf({ ...ef, branch: v.target.value })}>
                          <option value="">Shared</option>
                          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      ) : (e.branch_name ?? <span className="opacity-50">Shared</span>)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {u ? <Badge tone="pine">{u.username} · {u.role}</Badge> : <span className="text-muted">No login</span>}
                  </td>
                  <td className="px-4 py-3">{e.status}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editing ? (
                      <>
                        <button className="btn-ghost text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => setEditingId(null)}>Cancel</button>
                        <button className="btn-primary text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => saveEdit.mutate(e.id)}>Save</button>
                      </>
                    ) : (
                      <button className="btn-ghost text-xs py-1 px-2" onClick={() => startEdit(e)}>Edit</button>
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
