import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { NavIcon } from "../../design/NavIcon";
import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { money } from "../../lib/money";

interface Item { id: number; title: string; detail: string; meta?: string; amount?: string }
interface Section { key: string; title: string; route: string; items: Item[] }

/** Per-section presentation + how its action hits the existing endpoints. The
 *  inbox never invents approval rules — it fronts flows enforced server-side.
 *  `confirm` gates the consequential ones (spend / stock movement); `tone:issue`
 *  marks the fulfilment stage so it doesn't read as another sign-off. */
const SECTION_META: Record<string, {
  icon: string; approve: string; reject?: "reason" | "note";
  purpose: string; confirm?: "money" | "stock"; tone?: "issue";
}> = {
  po: { icon: "procurement", approve: "Approve", purpose: "Spend awaiting your sign-off", confirm: "money" },
  indents: { icon: "matreq", approve: "Approve", purpose: "Stock requested by departments" },
  issues: { icon: "matreq", approve: "Issue", purpose: "Release approved stock from the store", confirm: "stock", tone: "issue" },
  dishes: { icon: "recipes", approve: "Approve", reject: "reason", purpose: "New menu items pending review" },
  leave: { icon: "leave", approve: "Approve", reject: "note", purpose: "Time-off awaiting sign-off" },
};

const FALLBACK_META = { icon: "notifications", approve: "Approve", purpose: "Awaiting your action" } as const;

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
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  /** Flipping the toggle approves / issues. Consequential actions (releasing
   *  spend or stock) confirm first; the switch springs back if you cancel. */
  async function flip(section: string, item: Item) {
    const meta = SECTION_META[section];
    setPendingId(`${section}:${item.id}`); // optimistic — the switch moves on tap
    try {
      if (meta?.confirm === "money") {
        const ok = await ask({
          title: `Approve ${item.title}?`,
          message: `Authorises spend of ${item.amount ? money(item.amount) : "this order"} — ${item.detail}.`,
          confirm: true, confirmLabel: "Approve spend",
        });
        if (!ok) { setPendingId(null); return; }
      } else if (meta?.confirm === "stock") {
        const ok = await ask({
          title: `Issue ${item.title}?`,
          message: "Releases the stock from the store. This can't be undone here.",
          confirm: true, confirmLabel: "Issue stock",
        });
        if (!ok) { setPendingId(null); return; }
      }
      await act.mutateAsync({ section, id: item.id, decision: "approve" });
    } catch {
      /* onError surfaces the toast */
    } finally {
      setPendingId(null);
    }
  }

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
        icon={<ClipboardCheck size={20} />}
        eyebrow="Requests & approvals"
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
            const meta = SECTION_META[s.key] ?? FALLBACK_META;
            const issue = meta.tone === "issue";
            return (
              <Card key={s.key} className={issue ? "border-l-4 border-l-amber" : undefined}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
                      issue ? "bg-amber-50 text-amber" : "bg-pine-50 text-pine"}`}>
                      <NavIcon name={meta.icon} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink truncate">{s.title}</span>
                        <Badge tone={issue ? "amber" : "pine"}>{s.items.length}</Badge>
                      </div>
                      <div className="text-xs text-muted truncate">{meta.purpose}</div>
                    </div>
                  </div>
                  <button className="text-sm text-pine hover:underline underline-offset-2 shrink-0"
                    onClick={() => nav(s.route)}>
                    Open screen →
                  </button>
                </div>
                <div className="divide-y divide-hairline">
                  {s.items.map((it) => (
                    <div key={it.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink truncate">{it.title}</div>
                        <div className="text-sm text-muted truncate">
                          {it.detail}
                          {it.meta && <span className="text-muted"> · {it.meta}</span>}
                        </div>
                      </div>
                      {it.amount && (
                        <div className="font-display text-base text-ink tabular-nums shrink-0 mr-1">
                          {money(it.amount)}
                        </div>
                      )}
                      <div className="flex items-center gap-3 shrink-0">
                        {meta.reject && (
                          <button className="btn-ghost text-xs py-1 text-clay"
                            disabled={act.isPending}
                            onClick={() => reject(s.key, it)}>
                            Reject
                          </button>
                        )}
                        <ApproveToggle
                          label={meta.approve}
                          tone={issue ? "issue" : "approve"}
                          on={pendingId === `${s.key}:${it.id}`}
                          disabled={act.isPending}
                          onFlip={() => flip(s.key, it)}
                        />
                      </div>
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

/** A switch that approves (or issues) on flip — one gesture instead of a button.
 *  It carries its action as a label so it's never a mystery switch, and the
 *  confirm dialog still guards the consequential flips (spend / stock). */
function ApproveToggle({ label, tone, on, disabled, onFlip }: {
  label: string; tone: "approve" | "issue"; on: boolean; disabled?: boolean; onFlip: () => void;
}) {
  const active = tone === "issue" ? "bg-amber" : "bg-success";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onFlip}
      className="group inline-flex items-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="text-xs font-medium text-muted group-hover:text-ink transition-colors">{label}</span>
      <span className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${on ? active : "bg-hairline"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
