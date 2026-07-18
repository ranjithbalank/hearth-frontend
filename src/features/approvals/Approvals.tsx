import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { NavIcon } from "../../design/NavIcon";
import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Item { id: number; title: string; detail: string }
interface Section { key: string; title: string; route: string; items: Item[] }

/** Which icon each section wears and how its actions hit the existing
 *  endpoints — the inbox never invents new approval rules, it only fronts
 *  the flows that already enforce them server-side. */
const SECTION_META: Record<string, { icon: string; approve: string; reject?: "reason" | "note" }> = {
  po: { icon: "procurement", approve: "Approve" },
  indents: { icon: "matreq", approve: "Approve" },
  issues: { icon: "matreq", approve: "Issue" },
  dishes: { icon: "recipes", approve: "Approve", reject: "reason" },
  leave: { icon: "leave", approve: "Approve", reject: "note" },
};

function actionUrl(section: string, id: number, decision: "approve" | "reject") {
  switch (section) {
    case "po": return `/purchase-orders/${id}/approve/`;
    case "indents":
    case "issues": return `/material-requests/${id}/advance/`;
    case "dishes": return `/recipes/${id}/${decision === "approve" ? "approve_dish" : "reject_dish"}/`;
    case "leave": return `/leave/${id}/decide/`;
    default: return "";
  }
}

export function Approvals() {
  const qc = useQueryClient();
  const toast = useToast();
  const ask = usePrompt();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["approvals"],
    queryFn: async () =>
      (await api.get<{ count: number; sections: Section[] }>("/approvals/")).data,
    refetchInterval: 30000,
  });

  const act = useMutation({
    mutationFn: async ({ section, id, decision, reason }: {
      section: string; id: number; decision: "approve" | "reject"; reason?: string;
    }) => {
      const body = section === "leave"
        ? { decision, note: reason ?? "" }
        : decision === "reject" ? { reason } : {};
      return (await api.post(actionUrl(section, id, decision), body)).data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast(v.decision === "approve"
        ? (v.section === "issues" ? "Issued" : "Approved")
        : "Rejected");
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not complete", "error"),
  });

  async function reject(section: string, item: Item) {
    const reason = await ask({
      title: `Reject — ${item.title}`,
      placeholder: SECTION_META[section].reject === "reason"
        ? "Reason (required)" : "Note (optional)",
    });
    if (reason === null || reason === undefined) return;
    act.mutate({ section, id: item.id, decision: "reject", reason: String(reason) });
  }

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Everything awaiting your sign-off"
        action={<Badge tone={data.count ? "clay" : "pine"}>{data.count} waiting</Badge>}
      />
      {!data.sections.length ? (
        <EmptyState title="All caught up"
          hint="Nothing is waiting on you — new requests will appear here." />
      ) : (
        <div className="space-y-4">
          {data.sections.map((s) => {
            const meta = SECTION_META[s.key] ?? { icon: "notifications", approve: "Approve" };
            return (
              <Card key={s.key}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-pine-50 text-pine">
                      <NavIcon name={meta.icon} />
                    </span>
                    {s.title}
                    <Badge tone="amber">{s.items.length}</Badge>
                  </div>
                  <button className="text-sm text-pine" onClick={() => nav(s.route)}>
                    Open screen →
                  </button>
                </div>
                <div className="divide-y divide-line">
                  {s.items.map((it) => (
                    <div key={it.id} className="py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{it.title}</div>
                        <div className="text-sm text-muted truncate">{it.detail}</div>
                      </div>
                      {meta.reject && (
                        <button className="btn-ghost text-xs py-1 text-clay"
                          disabled={act.isPending}
                          onClick={() => reject(s.key, it)}>
                          Reject
                        </button>
                      )}
                      <button className="btn-outline text-xs py-1"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ section: s.key, id: it.id, decision: "approve" })}>
                        {meta.approve}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
