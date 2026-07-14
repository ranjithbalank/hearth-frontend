import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useToast } from "../../design/Toast";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { amount } from "../../lib/inputs";
import { currencySymbol, money } from "../../lib/money";

interface Rates { veg_rate: string; nonveg_rate: string }

export function CateringPrices() {
  const qc = useQueryClient();
  const toast = useToast();
  const [veg, setVeg] = useState("");
  const [nonveg, setNonveg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["catering-prices"],
    queryFn: async () => (await api.get<Rates>("/banquets/catering_prices/")).data,
  });

  useEffect(() => {
    if (data) { setVeg(Number(data.veg_rate) ? data.veg_rate : ""); setNonveg(Number(data.nonveg_rate) ? data.nonveg_rate : ""); }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/banquets/catering_prices/", {
      veg_rate: Number(veg || 0), nonveg_rate: Number(nonveg || 0),
    })).data,
    onSuccess: () => { toast("Catering prices saved"); qc.invalidateQueries({ queryKey: ["catering-prices"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save", "error"),
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Catering Prices" subtitle="Standard per-plate rates for banquet events" />
      <Card className="max-w-md">
        <div className="text-sm text-muted mb-4">
          Set the property's standard veg and non-veg plate prices once. New banquet
          bookings pre-fill these rates automatically — you can still adjust them per event.
        </div>

        <label className="block text-xs font-semibold text-muted mb-1">Veg — {currencySymbol()} per plate</label>
        <input className="input mb-3" inputMode="decimal" placeholder="e.g. 850"
          value={veg} onChange={(e) => setVeg(amount(e.target.value))} />

        <label className="block text-xs font-semibold text-muted mb-1">Non-veg — {currencySymbol()} per plate</label>
        <input className="input mb-4" inputMode="decimal" placeholder="e.g. 1050"
          value={nonveg} onChange={(e) => setNonveg(amount(e.target.value))} />

        <div className="text-xs text-muted mb-4">
          Example — 100 veg plates at {money(Number(veg || 0))} = {money(Number(veg || 0) * 100)}.
        </div>

        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save prices"}
        </button>
      </Card>
    </div>
  );
}
