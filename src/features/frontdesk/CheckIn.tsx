import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { Reservation, Room } from "../../lib/types";
import { WalkInForm } from "./WalkInForm";

const STEPS = ["Guest", "Room", "ID proof", "Guest type", "Payment"];
const GUEST_TYPES = [
  { key: "individual", label: "Individual" },
  { key: "corporate", label: "Corporate (bill to company)" },
  { key: "travel_agent", label: "Travel agent" },
  { key: "complimentary", label: "Complimentary" },
];

export function CheckIn() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const resvId = Number(params.get("reservation"));
  const [step, setStep] = useState(0);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [idType, setIdType] = useState("Passport");
  const [idNumber, setIdNumber] = useState("");
  const [guestType, setGuestType] = useState("individual");
  const [code, setCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const { data: resv, isLoading } = useQuery({
    queryKey: ["resv", resvId],
    queryFn: async () => (await api.get<Reservation>(`/reservations/${resvId}/`)).data,
    enabled: !!resvId,
  });
  const { data: rooms } = useQuery({
    queryKey: ["room-options", resvId],
    queryFn: async () => (await api.get<Room[]>(`/reservations/${resvId}/room_options/`)).data,
    enabled: !!resvId,
  });

  const complete = useMutation({
    mutationFn: async () =>
      (await api.post("/checkin/", {
        reservation: resvId, room: roomId ?? rooms?.[0]?.id,
        id_type: idType, id_number: idNumber, guest_type: guestType,
        mobile: mobile ? `${code} ${mobile}` : "",
      })).data,
    onSuccess: (folio) => setDone(`Checked in to room ${folio.room_number} · folio #${folio.id}`),
  });

  if (!resvId) return <ArrivalPicker />;
  if (isLoading || !resv) return <Spinner />;

  if (done) {
    return (
      <div>
        <PageHeader title="Check-In Complete" />
        <Card className="bg-pine-50 border-pine/20">
          <div className="text-pine font-medium">{done}</div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={() => nav("/folios")}>Open folio</button>
            <button className="btn-outline" onClick={() => nav("/frontdesk")}>Back to Front Desk</button>
          </div>
        </Card>
      </div>
    );
  }

  const room = rooms?.find((r) => r.id === roomId) ?? rooms?.[0];

  return (
    <div>
      <PageHeader title="Check-In" subtitle={resv.guest_name} />
      <div className="flex gap-2 mb-5">
        {STEPS.map((s, i) => (
          <div key={s} className={`pill ${i === step ? "bg-pine text-white" : i < step ? "bg-pine-50 text-pine" : "bg-hairline text-muted"}`}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      <Card className="max-w-xl">
        {step === 0 && (
          <div>
            <div className="font-semibold mb-3">Guest information</div>
            <Field label="Name" value={resv.guest_name} />
            <Field label="Room type" value={resv.room_type_code} />
            <Field label="Stay" value={`${resv.checkin_date} → ${resv.checkout_date} (${resv.nights}n)`} />
            <Field label="Source" value={resv.source_label} />
          </div>
        )}
        {step === 1 && (
          <div>
            <div className="font-semibold mb-3">Assign room</div>
            <div className="grid grid-cols-3 gap-2">
              {rooms?.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRoomId(r.id)}
                  className={`rounded-card border p-3 text-left ${(room?.id === r.id) ? "border-pine bg-pine-50" : "border-hairline"}`}
                >
                  <div className="font-display text-lg">{r.number}</div>
                  <div className="text-xs text-muted">Floor {r.floor}</div>
                </button>
              ))}
              {!rooms?.length && <div className="text-sm text-muted">No sellable rooms of this type.</div>}
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div className="font-semibold mb-3">ID / KYC &amp; contact</div>
            <label className="block text-xs font-semibold text-muted mb-1">Mobile</label>
            <div className="flex gap-2 mb-3">
              <select className="input w-24" value={code} onChange={(e) => setCode(e.target.value)}>
                {["+91", "+1", "+44", "+971", "+65", "+61", "+49", "+33", "+94", "+880", "+977"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input className="input flex-1" inputMode="numeric" placeholder="Mobile number"
                value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 12))} />
            </div>
            <label className="block text-xs font-semibold text-muted mb-1">ID type</label>
            <select className="input mb-3" value={idType} onChange={(e) => setIdType(e.target.value)}>
              <option>Passport</option><option>Aadhaar</option><option>Driving Licence</option><option>Voter ID</option>
            </select>
            <label className="block text-xs font-semibold text-muted mb-1">ID number</label>
            <input className="input" placeholder="ID number"
              value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/[^A-Za-z0-9-]/g, "").toUpperCase().slice(0, 20))} />
          </div>
        )}
        {step === 3 && (
          <div>
            <div className="font-semibold mb-3">Guest type</div>
            <div className="grid gap-2">
              {GUEST_TYPES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGuestType(g.key)}
                  className={`text-left rounded-card border p-3 ${guestType === g.key ? "border-pine bg-pine-50" : "border-hairline"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 4 && (
          <div>
            <div className="font-semibold mb-3">Payment / deposit</div>
            <Field label="Room" value={room ? `${room.number}` : "—"} />
            <Field label="Rate" value={`${inr(resv.rate)}/night`} />
            <Field label="Deposit" value={resv.prepaid ? `${inr(resv.deposit)} (prepaid)` : "Collect at desk"} />
            <Field label="Routing" value={guestType === "corporate" ? "City ledger (BTC)" : "Guest folio"} />
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Continue</button>
          ) : (
            <button className="btn-primary" disabled={complete.isPending} onClick={() => complete.mutate()}>
              Complete check-in
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function ArrivalPicker() {
  const nav = useNavigate();
  const [walkin, setWalkin] = useState(false);
  const { data: arrivals, isLoading } = useQuery({
    queryKey: ["arrivals"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/arrivals/")).data,
  });
  if (isLoading) return <Spinner />;
  return (
    <div>
      <PageHeader
        title="Check-In"
        subtitle="Select an arrival, or register a walk-in"
        action={<button className="btn-primary" onClick={() => setWalkin(true)}>+ Walk-in</button>}
      />
      {walkin && <WalkInForm onCancel={() => setWalkin(false)} onCreated={(id) => nav(`/checkin?reservation=${id}`)} />}
      {!arrivals?.length ? (
        <EmptyState title="No pending arrivals" hint="Use “+ Walk-in” for a guest arriving without a booking." />
      ) : (
        <div className="space-y-3">
          {arrivals.map((a) => (
            <Card key={a.id} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="font-semibold">{a.guest_name}</div>
                <div className="text-sm text-muted">{a.room_type_code} · {a.nights}n · {inr(a.rate)}/night</div>
              </div>
              <Badge tone="info">{a.source_label}</Badge>
              <button className="btn-primary" onClick={() => nav(`/checkin?reservation=${a.id}`)}>Begin check-in</button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-line text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
