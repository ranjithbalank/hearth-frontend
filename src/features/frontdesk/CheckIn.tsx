import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PhoneInput, joinPhone, splitPhone } from "../../design/PhoneInput";
import { SignaturePad } from "../../design/SignaturePad";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { fileToScaledDataUrl } from "../../lib/image";
import { money } from "../../lib/money";
import type { Reservation, Room } from "../../lib/types";
import { WalkInForm } from "./WalkInForm";

const STEPS = ["Guest", "Room", "ID proof", "Guest type", "Signature", "Payment"];
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
  const [idScan, setIdScan] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [guestType, setGuestType] = useState("individual");
  const [companyName, setCompanyName] = useState("");
  const [code, setCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const { data: resv, isLoading } = useQuery({
    queryKey: ["resv", resvId],
    queryFn: async () => (await api.get<Reservation>(`/reservations/${resvId}/`)).data,
    enabled: !!resvId,
  });

  // Prefill the mobile from the guest already on the reservation (e.g. captured
  // at walk-in) so staff confirm it rather than re-entering it.
  useEffect(() => {
    if (resv?.guest_mobile) {
      const { code: c, number } = splitPhone(resv.guest_mobile);
      setCode(c);
      setMobile(number);
      setPrefilled(true);
    }
  }, [resv?.guest_mobile]);
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
        company_name: guestType === "corporate" ? companyName.trim() : "",
        mobile: joinPhone(code, mobile),
        id_scan: idScan, signature: signature ?? "",
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
            <label className="block text-xs font-semibold text-muted mb-1">Mobile <span className="text-clay">*</span></label>
            <PhoneInput code={code} number={mobile} onCode={setCode} onNumber={setMobile} />
            <div className={`text-xs mt-1 mb-3 ${mobile.trim().length < 7 ? "text-clay" : "text-muted"}`}>
              {mobile.trim().length < 7
                ? "A valid mobile number is required to check in."
                : prefilled ? "On file from the reservation — edit if it has changed." : "Saved to the guest's profile."}
            </div>
            <label className="block text-xs font-semibold text-muted mb-1">ID type</label>
            <select className="input mb-3" value={idType} onChange={(e) => setIdType(e.target.value)}>
              <option>Passport</option><option>Aadhaar</option><option>Driving Licence</option><option>Voter ID</option>
            </select>
            <label className="block text-xs font-semibold text-muted mb-1">ID number <span className="text-clay">*</span></label>
            <input className="input" placeholder="ID number (required)"
              value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/[^A-Za-z0-9-]/g, "").toUpperCase().slice(0, 20))} />
            {!idNumber.trim() && <div className="text-xs text-clay mt-1">A valid ID proof is required to check in.</div>}

            <label className="block text-xs font-semibold text-muted mb-1 mt-4">ID scan / photo</label>
            <div className="flex items-center gap-3">
              {idScan ? (
                <img src={idScan} alt="ID scan" className="h-20 rounded-lg border border-hairline object-cover" />
              ) : (
                <div className="h-20 w-28 rounded-lg border border-dashed border-hairline flex items-center justify-center text-xs text-muted">
                  No scan
                </div>
              )}
              <div>
                <label className="btn-outline text-xs cursor-pointer inline-block">
                  {idScan ? "Retake" : "Scan / upload"}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try { setIdScan(await fileToScaledDataUrl(file)); }
                      catch { alert("That file isn't an image."); }
                    }} />
                </label>
                {idScan && <button className="btn-ghost text-xs ml-2" onClick={() => setIdScan("")}>Remove</button>}
                <div className="text-xs text-muted mt-1">
                  Photo of the {idType} — stored on the registration record.
                </div>
              </div>
            </div>
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
            {guestType === "corporate" && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-muted mb-1">Company name <span className="text-clay">*</span></label>
                <input className="input" placeholder="Company the folio bills to"
                  value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                {!companyName.trim() && <div className="text-xs text-clay mt-1">Enter the company name for bill-to-company.</div>}
              </div>
            )}
          </div>
        )}
        {step === 4 && (
          <div>
            <div className="font-semibold mb-1">Guest signature</div>
            <div className="text-sm text-muted mb-3">
              The guest signs the registration record — confirming the stay details and
              the house rules. Stored with the ID proof on the folio.
            </div>
            <SignaturePad onChange={setSignature} />
            {!signature && <div className="text-xs text-clay mt-1">A signature is required to complete check-in.</div>}
          </div>
        )}
        {step === 5 && (
          <div>
            <div className="font-semibold mb-3">Payment / deposit</div>
            <Field label="Room" value={room ? `${room.number}` : "—"} />
            <Field label="Rate" value={`${money(resv.rate)}/night`} />
            <Field label="Deposit" value={resv.prepaid ? `${money(resv.deposit)} (prepaid)` : "Collect at desk"} />
            <Field label="Routing" value={guestType === "corporate" ? "City ledger (BTC)" : "Guest folio"} />
            {guestType === "corporate" && <Field label="Bill to" value={companyName || "—"} />}
            <Field label="ID proof" value={`${idType} · ${idNumber}${idScan ? " · scan ✓" : " · no scan"}`} />
            <Field label="Signature" value={signature ? "Captured ✓" : "—"} />
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary"
              disabled={(step === 2 && (!idNumber.trim() || mobile.trim().length < 7))
                || (step === 3 && guestType === "corporate" && !companyName.trim())
                || (step === 4 && !signature)}
              onClick={() => setStep((s) => s + 1)}>Continue</button>
          ) : (
            <button className="btn-primary"
              disabled={complete.isPending || !idNumber.trim() || mobile.trim().length < 7
                || (guestType === "corporate" && !companyName.trim()) || !signature}
              onClick={() => complete.mutate()}>
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
                <div className="text-sm text-muted">{a.room_type_code} · {a.nights}n · {money(a.rate)}/night</div>
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
