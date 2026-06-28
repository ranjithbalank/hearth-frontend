import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface WorkOrder {
  id: number;
  room_number: string | null;
  title: string;
  detail: string;
  status: string;
  status_label: string;
}

const TONE: Record<string, "info" | "amber" | "pine"> = {
  open: "info",
  in_progress: "amber",
  done: "pine",
};

export function Engineering() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => (await api.get<WorkOrder[]>("/work-orders/")).data,
  });

  const advance = useMutation({
    mutationFn: async (wo: WorkOrder) => (await api.patch(`/work-orders/${wo.id}/advance/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Engineering" subtitle="Maintenance work orders" />
      {!data?.length ? (
        <EmptyState title="No work orders" hint="OOO rooms raise work orders here." />
      ) : (
        <div className="space-y-3">
          {data.map((w) => (
            <div key={w.id} className="card p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="font-semibold">{w.title}</div>
                <div className="text-sm text-muted">
                  {w.room_number ? `Room ${w.room_number}` : "General"} {w.detail && `· ${w.detail}`}
                </div>
              </div>
              <Badge tone={TONE[w.status] ?? "info"}>{w.status_label}</Badge>
              {w.status !== "done" && (
                <button className="btn-outline" onClick={() => advance.mutate(w)}>Advance</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
