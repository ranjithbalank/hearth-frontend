import { useQuery } from "@tanstack/react-query";

import { EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Token {
  token_no: number;
  mode: string;
  kitchen_status: string;
  brand: string;
  source_platform: string;
}

/** Wall-mounted pickup-token board: big numbers, Preparing → Ready columns.
 *  Guests waiting for takeaway/delivery watch this instead of asking staff. */
export function TokenBoard() {
  const { data, isLoading } = useQuery({
    queryKey: ["tokens"],
    queryFn: async () => (await api.get<Token[]>("/pos/orders/tokens/")).data,
    refetchInterval: 5000,
  });

  if (isLoading) return <Spinner />;
  const preparing = data?.filter((t) => t.kitchen_status === "cooking") ?? [];
  const ready = data?.filter((t) => t.kitchen_status === "ready") ?? [];

  return (
    <div>
      <PageHeader title="Token board" subtitle="Takeaway & delivery pickup status · auto-refresh" />
      {!data?.length ? (
        <EmptyState title="No active tokens" hint="Takeaway/delivery orders appear here when their KOT fires." />
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-sm uppercase tracking-wide text-muted mb-3">⏳ Preparing</div>
            <div className="flex flex-wrap gap-3">
              {preparing.map((t) => (
                <div key={t.token_no} className="card px-6 py-4 text-center bg-amber-50 border-amber-300">
                  <div className="font-display text-5xl">{t.token_no}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted mt-1">
                    {t.brand || t.source_platform || t.mode}
                  </div>
                </div>
              ))}
              {!preparing.length && <div className="text-sm text-muted py-6">Nothing in the kitchen.</div>}
            </div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-wide text-pine mb-3">✅ Ready — please collect</div>
            <div className="flex flex-wrap gap-3">
              {ready.map((t) => (
                <div key={t.token_no} className="card px-6 py-4 text-center bg-pine-50 border-pine">
                  <div className="font-display text-5xl text-pine">{t.token_no}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted mt-1">
                    {t.brand || t.source_platform || t.mode}
                  </div>
                </div>
              ))}
              {!ready.length && <div className="text-sm text-muted py-6">Nothing ready yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
