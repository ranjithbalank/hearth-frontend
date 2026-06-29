import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Req {
  id: number;
  department: string;
  requested_by: string;
  status: string;
  lines: { ingredient: string; qty: string }[];
}

const TONE: Record<string, "info" | "amber" | "pine"> = {
  requested: "info",
  approved: "amber",
  issued: "pine",
};
const NEXT_LABEL: Record<string, string> = { requested: "Approve", approved: "Issue (deduct stock)" };

export function MaterialRequests() {
  const qc = useQueryClient();
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
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Material Requests" subtitle="Departmental indents · Requested → Approved → Issued" />
      {!data?.length ? (
        <EmptyState title="No indents" hint="Departments raise stock requests here." />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center gap-3">
                <div className="font-semibold">Indent #{r.id}</div>
                <span className="text-sm text-muted">{r.department} · {r.requested_by}</span>
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
