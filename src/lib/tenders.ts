import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export interface PaymentMethodOpt {
  id: number; name: string; active: boolean;
  counts_as_cash: boolean; captain_allowed: boolean; builtin: boolean;
}

/** Settle buttons come from the payment-methods master (Settings > Masters).
 *  Captain-ish roles (Captain / Bar Captain) only see tenders flagged
 *  captain_allowed — drawer cash stays at the cashier counter (BRD 5.10).
 *  Falls back to the classic three while the master is still loading. */
export function useTenders(captainish: boolean): string[] {
  const { data } = useQuery({
    queryKey: ["master-payment-methods"],
    queryFn: async () => (await api.get<PaymentMethodOpt[]>("/masters/payment-methods/")).data,
  });
  if (!data?.length) return captainish ? ["UPI", "Gateway"] : ["Cash", "UPI", "Gateway"];
  return data
    .filter((m) => m.active && (!captainish || m.captain_allowed))
    .map((m) => m.name);
}
