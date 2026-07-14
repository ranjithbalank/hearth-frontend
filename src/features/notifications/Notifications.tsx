import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { NavIcon } from "../../design/NavIcon";
import { Badge, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { NOTIFICATION_ROUTES } from "../../lib/notifications";

interface Alert {
  severity: "critical" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
}

const SEVERITY: Record<Alert["severity"], { tone: "clay" | "amber" | "info"; accent: string; chip: string; rank: number }> = {
  critical: { tone: "clay", accent: "border-clay", chip: "bg-clay-50 text-clay", rank: 0 },
  warning: { tone: "amber", accent: "border-amber", chip: "bg-amber-50 text-amber-600", rank: 1 },
  info: { tone: "info", accent: "border-info", chip: "bg-info-50 text-info", rank: 2 },
};

export function Notifications() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<{ count: number; alerts: Alert[] }>("/notifications/")).data,
  });

  if (isLoading || !data) return <Spinner />;
  const alerts = [...data.alerts].sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Operational alerts"
        action={<Badge tone="clay">{data.count} active</Badge>}
      />
      {!alerts.length ? (
        <EmptyState title="All clear" hint="No operational alerts right now." />
      ) : (
        <div className="space-y-3">
          {alerts.map((a, i) => {
            const s = SEVERITY[a.severity] ?? SEVERITY.info;
            const route = NOTIFICATION_ROUTES[a.module];
            return (
              <button
                key={i}
                onClick={() => route && nav(route)}
                className={`card p-4 w-full text-left flex items-center gap-4 hover:bg-cream border-l-4 ${s.accent} ${
                  route ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${s.chip}`}>
                  <NavIcon name={a.module} />
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-sm text-muted">{a.detail}</div>
                </div>
                <Badge tone={s.tone}>{a.severity}</Badge>
                {route && <span className="text-muted text-sm">→</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
