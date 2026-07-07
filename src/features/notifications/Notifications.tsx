import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Badge, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Alert {
  severity: "critical" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
}

const TONE: Record<string, "clay" | "amber" | "info"> = {
  critical: "clay",
  warning: "amber",
  info: "info",
};

// module key -> route
const ROUTES: Record<string, string> = {
  inventory: "/inventory",
  engineering: "/engineering",
  channel: "/channel",
  procurement: "/procurement",
  banquets: "/banquets",
  reports: "/reports",
  recipes: "/recipes?tab=pending",
};

export function Notifications() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<{ count: number; alerts: Alert[] }>("/notifications/")).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Operational alerts"
        action={<Badge tone="clay">{data.count} active</Badge>}
      />
      {!data.alerts.length ? (
        <EmptyState title="All clear" hint="No operational alerts right now." />
      ) : (
        <div className="space-y-3">
          {data.alerts.map((a, i) => (
            <button
              key={i}
              onClick={() => ROUTES[a.module] && nav(ROUTES[a.module])}
              className="card p-4 w-full text-left flex items-center gap-4 hover:bg-cream"
            >
              <Badge tone={TONE[a.severity] ?? "info"}>{a.severity}</Badge>
              <div className="flex-1">
                <div className="font-semibold">{a.title}</div>
                <div className="text-sm text-muted">{a.detail}</div>
              </div>
              {ROUTES[a.module] && <span className="text-muted text-sm">→</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
