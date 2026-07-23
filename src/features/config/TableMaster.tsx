import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { CsvImport } from "../../design/CsvImport";
import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { digits } from "../../lib/inputs";
import type { Branch, Table } from "../../lib/types";

export function TableMaster() {
  const qc = useQueryClient();
  const toast = useToast();
  const ask = usePrompt();
  const { user, activeBranch } = useApp();

  const allBranches = user?.branches === "*";
  const { data: everyBranch } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/auth/branches/")).data,
    enabled: allBranches,
  });
  const branchOptions = allBranches
    ? everyBranch ?? []
    : Array.from(
        new Map(
          (Array.isArray(user?.branches) ? user.branches : [])
            .map((a) => [a.branch, { id: a.branch, name: a.branch_name }]),
        ).values(),
      );
  // Single-branch logins never need to pick — auto-fill the only option so
  // "Add table" can't silently go out with no branch (that's exactly the
  // bug that made tables disappear from branch-scoped views before).
  const defaultLocation = activeBranch ? String(activeBranch)
    : branchOptions.length === 1 ? String(branchOptions[0].id) : "";
  const emptyForm = { name: "", floor: "Ground", section: "AC", seats: "4", location: defaultLocation };
  const [form, setForm] = useState(emptyForm);
  const needsBranchPick = branchOptions.length > 1;
  const [branchFilter, setBranchFilter] = useState<number | "all">(activeBranch ?? "all");
  const branchName = (id: number) => branchOptions.find((b) => b.id === id)?.name ?? `Branch ${id}`;

  const { data, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => (await api.get<Table[]>("/pos/tables/")).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/pos/tables/", {
        name: form.name, floor: form.floor, section: form.section, seats: Number(form.seats) || 1,
        location: Number(form.location),
      })).data,
    onSuccess: () => { setForm({ ...emptyForm, location: form.location }); toast("Table added"); qc.invalidateQueries({ queryKey: ["tables"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add table", "error"),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/pos/tables/${id}/`),
    onSuccess: () => { toast("Table deleted"); qc.invalidateQueries({ queryKey: ["tables"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not delete that table", "error"),
  });

  if (isLoading || !data) return <Spinner />;

  const visible = branchFilter === "all" ? data : data.filter((t) => t.location === branchFilter);
  // Branch-wise grouping only kicks in once there's actually more than one
  // branch to tell apart — a single-branch login (or a filtered view) just
  // sees plain floor/section groups, same as before. Floor sits between
  // branch and section: a table's floor (Ground/1st/Lawn) groups it before
  // AC/Non-AC does, same order the Add-table form asks the questions in.
  const showBranchGroups = needsBranchPick && branchFilter === "all";
  const groups: Record<string, Table[]> = {};
  visible.forEach((t) => {
    const parts = [
      showBranchGroups ? (t.location ? branchName(t.location) : "No branch") : null,
      t.floor || null,
      t.section,
    ].filter(Boolean);
    const key = parts.join(" · ");
    (groups[key] ??= []).push(t);
  });

  return (
    <div>
      <PageHeader title="Table Master" subtitle="Floor sections &amp; tables" />

      <CsvImport path="/pos/tables/import/" templateFilename="tables-template.csv"
        noun="table" invalidate={["tables"]}
        hint="Setting up many tables? Download the format, fill it in Excel, and upload once — leave branch blank to use your own." />

      <Card className="mb-4">
        <div className="font-semibold mb-3">Add table</div>

        {/* Where it belongs, decided first: branch, then floor, then section. */}
        <div className={`grid gap-2 ${needsBranchPick ? "grid-cols-3 mb-3 pb-3 border-b border-hairline" : "grid-cols-2 mb-2"}`}>
          {needsBranchPick && (
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Branch</label>
              <select className="input w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                <option value="">Branch… (required)</option>
                {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Floor (required)</label>
            <input className="input w-full" placeholder="e.g. Ground, 1st, Lawn" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Section</label>
            <input className="input w-full" placeholder="e.g. AC / Non-AC" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          </div>
        </div>

        {/* What the table itself is, decided last. */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Name</label>
            <input className="input w-full" placeholder="e.g. A7" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Seats</label>
            <input className="input w-full" inputMode="numeric" placeholder="4" value={form.seats} onChange={(e) => setForm({ ...form, seats: digits(e.target.value, 3) })} />
          </div>
        </div>

        {!branchOptions.length && (
          <div className="text-xs text-clay mt-2">
            No branch is set up for your login yet — a table added without one won't show up on the floor. Ask an admin to grant branch access first.
          </div>
        )}
        <button
          className="btn-primary mt-3"
          disabled={!form.name || !form.location || !form.floor.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          Add table
        </button>
      </Card>

      {needsBranchPick && (
        <select
          className="input mb-4 w-64"
          value={branchFilter}
          onChange={(e) => {
            const val = e.target.value === "all" ? "all" : Number(e.target.value);
            setBranchFilter(val);
            // Viewing one branch's tables? Default new ones to that same
            // branch too — one less pick when you're adding several in a row.
            if (val !== "all") setForm((f) => ({ ...f, location: String(val) }));
          }}
        >
          <option value="all">All branches</option>
          {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      <div className="space-y-5">
        {Object.entries(groups).map(([sec, list]) => (
          <div key={sec}>
            <div className="text-xs uppercase tracking-wide text-muted mb-2">{sec}</div>
            <div className="grid grid-cols-6 gap-2">
              {list.map((t) => (
                <div key={t.id} className="card p-3 text-center">
                  <div className="font-display text-lg">{t.name}</div>
                  <div className="text-xs text-muted">{t.seats} seats</div>
                  {needsBranchPick && t.location && (
                    <div className="text-[10px] text-muted mt-1 truncate">{branchName(t.location)}</div>
                  )}
                  <button
                    className="btn-ghost text-xs text-clay w-full mt-1 py-1"
                    disabled={remove.isPending}
                    onClick={async () => {
                      const ok = await ask({
                        title: "Delete table", confirm: true, danger: true, confirmLabel: "Delete",
                        message: `Delete table ${t.name}? This can't be undone.`,
                      });
                      if (ok) remove.mutate(t.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!visible.length && (
          <div className="text-sm text-muted text-center py-8">No tables in this branch yet — add one above.</div>
        )}
      </div>
    </div>
  );
}
