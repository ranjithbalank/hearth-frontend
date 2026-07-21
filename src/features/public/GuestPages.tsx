import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Logo, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { currencySymbol } from "../../lib/money";
import { fmtDate } from "../../lib/date";

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

export function GuestNotFound() {
  return (
    <Shell>
      <div className="card p-8 text-center">
        <div className="font-display text-3xl text-ink mb-1">404</div>
        <div className="font-display text-lg">Page not found</div>
        <div className="text-sm text-muted mt-1">
          This link may have expired. Please scan the QR code again or ask our staff for help.
        </div>
      </div>
    </Shell>
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

export function PreCheckinPage() {
  const [step, setStep] = useState<"verify" | "form" | "done">("verify");
  const [booking, setBooking] = useState("");
  const [verify, setVerify] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [d, setD] = useState({ mobile: "", email: "", id_type: "Aadhaar", id_number: "", eta: "", note: "" });
  const [error, setError] = useState("");

  async function lookup() {
    setError("");
    try {
      const r = await api.post("/public/pre-checkin/", { booking, verify });
      setSummary(r.data);
      setStep(r.data.precheckin_done ? "done" : "form");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Booking not found");
    }
  }

  async function submit() {
    setError("");
    try {
      await api.post("/public/pre-checkin/", { booking, verify, details: d });
      setStep("done");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not save");
    }
  }

  return (
    <Shell>
      <div className="card p-6">
        <div className="font-display text-xl text-center mb-1">Online check-in</div>
        {step === "verify" && (
          <>
            <div className="text-xs text-muted text-center mb-4">Save time at the desk — check in before you arrive.</div>
            <input className="input w-full mb-2" placeholder="Booking number (e.g. 42)" inputMode="numeric"
              value={booking} onChange={(e) => setBooking(e.target.value.replace(/\D/g, ""))} />
            <input className="input w-full mb-3" placeholder="Registered mobile or surname"
              value={verify} onChange={(e) => setVerify(e.target.value)} />
            {error && <div className="text-sm text-clay mb-2 text-center">{error}</div>}
            <button className="btn-primary w-full" disabled={!booking || !verify.trim()} onClick={lookup}>
              Find my booking
            </button>
          </>
        )}
        {step === "form" && summary && (
          <>
            <div className="text-xs text-muted text-center mb-4">
              {summary.guest_name} · {summary.room_type} · {fmtDate(summary.checkin_date)} → {fmtDate(summary.checkout_date)}
            </div>
            <div className="grid gap-2">
              <input className="input" placeholder="Mobile" inputMode="tel" value={d.mobile}
                onChange={(e) => setD({ ...d, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
              <input className="input" placeholder="Email (optional)" value={d.email}
                onChange={(e) => setD({ ...d, email: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={d.id_type} onChange={(e) => setD({ ...d, id_type: e.target.value })}>
                  {["Aadhaar", "Passport", "Driving Licence", "Voter ID"].map((t) => <option key={t}>{t}</option>)}
                </select>
                <input className="input" placeholder="ID number" value={d.id_number}
                  onChange={(e) => setD({ ...d, id_number: e.target.value })} />
              </div>
              <input className="input" type="time" title="Expected arrival" value={d.eta}
                onChange={(e) => setD({ ...d, eta: e.target.value })} />
              <input className="input" placeholder="Any requests? (optional)" value={d.note}
                onChange={(e) => setD({ ...d, note: e.target.value })} />
            </div>
            {error && <div className="text-sm text-clay my-2 text-center">{error}</div>}
            <button className="btn-primary w-full mt-3" disabled={!d.mobile || !d.id_number.trim()} onClick={submit}>
              Complete check-in
            </button>
          </>
        )}
        {step === "done" && (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🛎</div>
            <div className="font-display text-xl mb-1">You're all set!</div>
            <div className="text-sm text-muted">Head straight to the desk on arrival — your details are ready.</div>
          </div>
        )}
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

interface QrMenuItem {
  id: number; name: string; price: string; diet: string;
  category_name: string; image: string;
}

/** Guest QR table ordering: scan the table QR → browse the menu → order to
 *  the kitchen. No login — the table token is the credential. */
export function QrOrderPage() {
  const token = useParam("token");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [placed, setPlaced] = useState<{ kot: string; ref: string; table: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["qr-menu", token],
    queryFn: async () => (await api.get<{ table: string; menu: QrMenuItem[] }>(`/pos/qr-order/?token=${token}`)).data,
    enabled: !!token,
    retry: false,
  });

  if (!token) return <Shell><div className="card p-6 text-center text-muted">Invalid table QR.</div></Shell>;
  if (isLoading) return <Shell><Spinner /></Shell>;
  if (!data) return <Shell><div className="card p-6 text-center text-muted">This table QR is not active — please call a server.</div></Shell>;

  if (placed) {
    return (
      <Shell>
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">👨‍🍳</div>
          <div className="font-display text-xl mb-1">Order sent to the kitchen!</div>
          <div className="text-sm text-muted mb-4">Table {placed.table} · {placed.kot}</div>
          <a className="btn-primary inline-block" href={`/order-status?ref=${placed.ref}`}>Track my order</a>
          <button className="btn-ghost w-full mt-2" onClick={() => { setPlaced(null); setCart({}); }}>
            Order more
          </button>
        </div>
      </Shell>
    );
  }

  const cats = [...new Set(data.menu.map((m) => m.category_name))];
  const count = Object.values(cart).reduce((s, n) => s + n, 0);
  const total = Object.entries(cart).reduce((s, [id, qty]) => {
    const item = data.menu.find((m) => m.id === Number(id));
    return s + (item ? Number(item.price) * qty : 0);
  }, 0);

  async function place() {
    setBusy(true); setError("");
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ menu_item: Number(id), qty }));
      const r = await api.post("/pos/qr-order/", { token, items });
      setPlaced({ kot: r.data.kot, ref: r.data.ref, table: r.data.table });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not place the order — please call a server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="text-center mb-3">
        <div className="font-display text-xl">Table {data.table}</div>
        <div className="text-xs text-muted">Order straight to the kitchen — pay at the counter.</div>
      </div>
      <div className="space-y-4 pb-24">
        {cats.map((c) => (
          <div key={c}>
            <div className="text-xs uppercase tracking-wide text-muted mb-1.5">{c}</div>
            <div className="space-y-1.5">
              {data.menu.filter((m) => m.category_name === c).map((m) => (
                <div key={m.id} className="card p-3 flex items-center gap-3">
                  {m.image && <img src={m.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-sm border ${m.diet === "veg" ? "border-pine" : "border-clay"}`}>
                        <span className={`block h-1 w-1 m-auto mt-0.5 rounded-full ${m.diet === "veg" ? "bg-pine" : "bg-clay"}`} />
                      </span>
                      <span className="font-medium text-sm truncate">{m.name}</span>
                    </div>
                    <div className="text-xs text-muted">{currencySymbol()}{Number(m.price)}</div>
                  </div>
                  {cart[m.id] ? (
                    <div className="flex items-center gap-2">
                      <button className="h-8 w-8 rounded-lg bg-hairline text-lg"
                        onClick={() => setCart((c2) => {
                          const n = (c2[m.id] ?? 0) - 1;
                          const { [m.id]: _, ...rest } = c2;
                          return n > 0 ? { ...c2, [m.id]: n } : rest;
                        })}>−</button>
                      <span className="w-5 text-center text-sm font-semibold">{cart[m.id]}</span>
                      <button className="h-8 w-8 rounded-lg bg-pine text-white text-lg"
                        onClick={() => setCart((c2) => ({ ...c2, [m.id]: (c2[m.id] ?? 0) + 1 }))}>+</button>
                    </div>
                  ) : (
                    <button className="btn-outline text-xs py-1.5"
                      onClick={() => setCart((c2) => ({ ...c2, [m.id]: 1 }))}>Add</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <div className="fixed bottom-20 left-4 right-4 card p-3 bg-clay/10 text-clay text-sm text-center">{error}</div>}
      {count > 0 && (
        <button
          className="fixed bottom-4 left-4 right-4 max-w-[420px] mx-auto btn-primary py-3 flex items-center justify-between px-5"
          disabled={busy}
          onClick={place}
        >
          <span>{count} item(s) · {currencySymbol()}{total.toFixed(0)}</span>
          <span className="font-semibold">{busy ? "Sending…" : "Place order →"}</span>
        </button>
      )}
    </Shell>
  );
}

/** Self-onboarding: HR's invite link lands here. The new hire sees who/what
 *  role they're being invited as, sets their own username + password, and
 *  is signed straight in — no separate login step. */
export function InvitePage() {
  const token = useParam("token");
  const { login } = useApp();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => (await api.get(`/public/invite/?t=${token}`)).data,
    enabled: !!token,
    retry: false,
  });

  if (!token) return <Shell><div className="card p-6 text-center text-muted">Invalid invite link.</div></Shell>;
  if (isLoading) return <Shell><Spinner /></Shell>;
  if (!data) {
    return (
      <Shell>
        <div className="card p-6 text-center text-muted">
          This invite link is invalid or has expired — ask your manager for a new one.
        </div>
      </Shell>
    );
  }

  async function submit() {
    setError("");
    setBusy(true);
    try {
      await api.post("/public/invite/", { t: token, username, password });
      await login(username, password);
      nav("/"); // "/invite" is matched before the auth gate — leave it now we're signed in
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not complete sign-up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="card p-6">
        <div className="font-display text-xl text-center mb-1">
          Welcome, {data.employee_name.split(" ")[0]}!
        </div>
        <div className="text-xs text-muted text-center mb-5">
          You've been invited as {data.role}{data.branch_name ? ` at ${data.branch_name}` : ""}.
          Choose your own username and password to get started.
        </div>
        <div className="grid gap-2 mb-3">
          <input className="input" placeholder="Choose a username" value={username}
            onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <input className="input" type="password" placeholder="Choose a password" value={password}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        {error && <div className="text-sm text-clay mb-2 text-center">{error}</div>}
        <button className="btn-primary w-full" disabled={!username || !password || busy} onClick={submit}>
          {busy ? "Setting up…" : "Create my account"}
        </button>
      </div>
    </Shell>
  );
}
