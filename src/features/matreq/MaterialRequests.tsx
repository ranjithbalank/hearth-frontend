import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Req {
  id: number;
  department: string;
  requested_by: string;
  status: string;
  lines: { ingredient: string; qty: string }[];
}
interface IngredientOpt { id: number; name: string; unit: string; current_stock: string }

const TONE: Record<string, "info" | "amber" | "pine"> = {
  requested: "info",
  approved: "amber",
  issued: "pine",
};
const NEXT_LABEL: Record<string, string> = { requested: "Approve", approved: "Issue (deduct stock)" };

export function MaterialRequests() {
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["matreq"],
    queryFn: async () => (await api.get<Req[]>("/material-requests/")).data,
  });

  const advance = useMutation({
    mutationFn: async (r: Req) => (await api.post(`/material-requests/${r.id}/advance/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matreq"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not advance", "error"),
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Material Requests"
        subtitle="Departmental indents · Requested → Approved → Issued (issues deduct store stock)"
        action={
          <button className="btn-primary text-sm" onClick={() => setCreating(true)}>
            + Request materials
          </button>
        }
      />

      {creating && (
        <NewRequestModal
          onDone={() => {
            setCreating(false);
            toast("Indent raised — awaiting approval by the store keeper / manager");
            qc.invalidateQueries({ queryKey: ["matreq"] });
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {!data?.length ? (
        <EmptyState title="No indents" hint="Departments raise stock requests here." />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center gap-3">
                <div className="font-semibold">Indent #{r.id}</div>
                <span className="text-sm text-muted">{r.department}{r.requested_by ? ` · by ${r.requested_by}` : ""}</span>
                <Badge tone={TONE[r.status] ?? "muted"}>{r.status}</Badge>
                {NEXT_LABEL[r.status] && (
                  <button className="btn-outline ml-auto" onClick={() => advance.mutate(r)}>
                    {NEXT_LABEL[r.status]}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-8 mt-3 text-sm pl-1">
                {r.lines.map((l, i) => (
                  <div key={i} className="flex justify-between border-b border-line py-1">
                    <span>{l.ingredient}</span>
                    <span className="text-muted">{Number(l.qty)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface DraftLine { ingredient: number | null; qty: string }
const EMPTY: DraftLine = { ingredient: null, qty: "" };
const DEPARTMENTS = ["Kitchen", "Bar", "Housekeeping", "Banquets", "Front Office", "Maintenance"];

function NewRequestModal({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [department, setDepartment] = useState("Kitchen");
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY }]);

  const { data: materials } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => (await api.get<IngredientOpt[]>("/inventory/")).data,
  });

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines(lines.map((l, ix) => (ix === i ? { ...l, ...patch } : l)));
  const valid = lines.filter((l) => l.ingredient && Number(l.qty) > 0);

  const save = useMutation({
    mutationFn: async () => (await api.post("/material-requests/", {
      department,
      lines: valid.map((l) => ({ ingredient: l.ingredient, qty: l.qty })),
    })).data,
    onSuccess: onDone,
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not raise the indent", "error"),
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[480px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">Request materials</div>
        <div className="text-sm text-muted mb-3">
          Raised in your name — the store keeper (or a manager) approves and issues it.
        </div>
        <select className="input mb-3" value={department} onChange={(e) => setDepartment(e.target.value)}>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <div className="space-y-2 overflow-y-auto flex-1">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-2 items-center">
              <select className="input" value={l.ingredient ?? ""}
                onChange={(e) => setLine(i, { ingredient: Number(e.target.value) || null })}>
                <option value="">Pick a material…</option>
                {materials?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {Number(m.current_stock)} {m.unit} in store
                  </option>
                ))}
              </select>
              <input className="input" inputMode="decimal" placeholder="Qty"
                value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
              <button className="btn-ghost text-clay text-sm"
                onClick={() => setLines(lines.length > 1 ? lines.filter((_, ix) => ix !== i) : [{ ...EMPTY }])}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn-outline text-xs mt-2" onClick={() => setLines([...lines, { ...EMPTY }])}>
          ＋ Add line
        </button>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!valid.length || save.isPending}
            onClick={() => save.mutate()}>
            Raise indent
          </button>
        </div>
      </div>
    </div>
  );
}
