import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "react-router-dom";

import { Logo, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

/** Guest-facing pages (no login): feedback form + order status tracker.
 *  Reached via the QR/link printed on the bill. */

function useParam(name: string) {
  return new URLSearchParams(useLocation().search).get(name) ?? "";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream flex items-start justify-center p-4 pt-10">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-4"><Logo /></div>
        {children}
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const t = useParam("t");
  const [rating, setRating] = useState(0);
  const [nps, setNps] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["fb", t],
    queryFn: async () => (await api.get(`/public/feedback/?t=${t}`)).data,
    enabled: !!t,
    retry: false,
  });

  if (!t) return <Shell><div className="card p-6 text-center text-muted">Invalid feedback link.</div></Shell>;
  if (isLoading) return <Shell><Spinner /></Shell>;
  if (!data) return <Shell><div className="card p-6 text-center text-muted">This feedback link has expired or is invalid.</div></Shell>;
  if (data.submitted || done) {
    return (
      <Shell>
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🙏</div>
          <div className="font-display text-xl mb-1">Thank you!</div>
          <div className="text-sm text-muted">Your feedback helps {data.property} serve you better.</div>
        </div>
      </Shell>
    );
  }

  async function submit() {
    setError("");
    try {
      await api.post("/public/feedback/", { t, rating, nps, comment });
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not submit — try again");
    }
  }

  return (
    <Shell>
      <div className="card p-6">
        <div className="font-display text-xl text-center mb-1">How was it?</div>
        <div className="text-xs text-muted text-center mb-5">
          {data.property}{data.where ? ` · ${data.where}` : ""}
        </div>

        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s)}
              className={`text-3xl transition-transform ${rating >= s ? "" : "grayscale opacity-40"} active:scale-110`}>
              ⭐
            </button>
          ))}
        </div>

        <div className="text-xs text-muted mb-2 text-center">How likely are you to recommend us? (0–10)</div>
        <div className="flex flex-wrap justify-center gap-1 mb-5">
          {Array.from({ length: 11 }, (_, i) => (
            <button key={i} onClick={() => setNps(i)}
              className={`h-8 w-8 rounded-lg border text-sm ${nps === i ? "bg-pine text-white border-pine" : "border-hairline"}`}>
              {i}
            </button>
          ))}
        </div>

        <textarea className="input w-full mb-3" rows={3} placeholder="Anything we should know? (optional)"
          value={comment} onChange={(e) => setComment(e.target.value)} />
        {error && <div className="text-sm text-clay mb-2 text-center">{error}</div>}
        <button className="btn-primary w-full" disabled={rating === 0} onClick={submit}>
          {rating === 0 ? "Tap a star to rate" : "Submit feedback"}
        </button>
      </div>
    </Shell>
  );
}

const STATUS_STEPS = [
  { key: "received", label: "Received" },
  { key: "cooking", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "served", label: "Done" },
];

export function OrderStatusPage() {
  const ref = useParam("ref");
  const { data, isLoading } = useQuery({
    queryKey: ["order-status", ref],
    queryFn: async () => (await api.get(`/public/order-status/?ref=${ref}`)).data,
    enabled: !!ref,
    refetchInterval: 10000,
    retry: false,
  });

  if (!ref) return <Shell><div className="card p-6 text-center text-muted">Invalid order link.</div></Shell>;
  if (isLoading) return <Shell><Spinner /></Shell>;
  if (!data) return <Shell><div className="card p-6 text-center text-muted">Order not found.</div></Shell>;

  const current = data.kitchen_status === "served" ? 3
    : data.kitchen_status === "ready" ? 2
      : data.kitchen_status === "cooking" ? 1 : 0;

  return (
    <Shell>
      <div className="card p-6 text-center">
        {data.token_no && (
          <>
            <div className="text-xs uppercase tracking-wide text-muted">Your token</div>
            <div className="font-display text-6xl text-pine my-2">{data.token_no}</div>
          </>
        )}
        <div className="flex items-center justify-center gap-1 mt-4 mb-2">
          {STATUS_STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <div className={`h-8 px-3 rounded-full text-xs flex items-center ${
                i <= current ? "bg-pine text-white" : "bg-hairline text-muted"}`}>
                {s.label}
              </div>
              {i < STATUS_STEPS.length - 1 && <div className="w-3 h-0.5 bg-hairline" />}
            </div>
          ))}
        </div>
        <div className="text-xs text-muted mt-3">
          {current === 2 ? "Your order is ready for pickup!" : current === 3 ? "Enjoy!" : "Updates automatically."}
        </div>
      </div>
    </Shell>
  );
}
