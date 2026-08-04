import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Check, CreditCard, Eye, EyeOff, Lock, Pencil, Trash2, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  addPaymentMethod,
  getBilling,
  getMyPaymentMethod,
  getStoredSession,
  listAgents,
  removeMyPaymentMethod,
  upgradePlan,
} from "@/lib/api";
import { PLAN_TIERS } from "@/lib/plans";
import type { Agent, BillingInfo, PaymentMethod, Plan } from "@/lib/types";

export const Route = createFileRoute("/_app/settings/billing")({
  component: BillingPage,
});

function daysRemaining(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return (digits.match(/.{1,4}/g) ?? []).join(" ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

type CardBrand = "VISA" | "MASTERCARD" | "AMEX";

function BrandMark({ brand, small }: { brand: CardBrand | null; small?: boolean }) {
  if (brand === "MASTERCARD") {
    return (
      <span className={`relative flex shrink-0 ${small ? "h-4 w-7" : "h-5 w-8"}`}>
        <span className={`absolute left-0 ${small ? "size-4" : "size-5"} bg-[#eb001b]`} />
        <span className={`absolute ${small ? "left-2 size-4" : "left-2.5 size-5"} bg-[#f79e1b] mix-blend-multiply`} />
      </span>
    );
  }
  if (brand === "AMEX") {
    return (
      <span className={`bg-[#2e77bc] font-machine font-bold text-white ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"}`}>
        AMEX
      </span>
    );
  }
  if (brand === "VISA") {
    return (
      <span className={`font-machine font-black tracking-tight text-[#1434cb] italic ${small ? "text-[14px]" : "text-[20px]"}`}>
        VISA
      </span>
    );
  }
  return <span className="font-machine text-[11px] font-bold tracking-[0.08em] text-[#8b93a3]">CARD</span>;
}

function detectBrand(digits: string): CardBrand | null {
  if (digits.length === 0) return null;
  if (digits.startsWith("34") || digits.startsWith("37")) return "AMEX";
  if (digits.startsWith("5")) return "MASTERCARD";
  if (digits.startsWith("4")) return "VISA";
  return null;
}

/** The visual card frame — shared by the live "add card" preview and the
 * read-only "view saved card" modal, since both display the same layout,
 * just fed from different data (in-progress form fields vs. a fetched
 * record with a masked number). */
function CardFrame({
  brand,
  numberText,
  holderText,
  expiryText,
  cvcText,
}: {
  brand: CardBrand | null;
  numberText: string;
  holderText: string;
  expiryText: string;
  cvcText?: string;
}) {
  return (
    <div className="relative aspect-[1.586/1] w-full max-w-[360px] overflow-hidden border-l-[3px] border-signal bg-gradient-to-br from-[#eef0f5] via-[#e3e7ee] to-[#c9d0dc] p-5 text-ink shadow-[0_20px_44px_-18px_rgba(20,30,50,0.35)]">
      {/* diagonal glass shine, plus a hairline edge highlight */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 border border-white/50" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="h-7 w-9 bg-gradient-to-br from-[#f2f3f5] via-[#c7ccd6] to-[#9aa1af]" />
          <BrandMark brand={brand} />
        </div>

        <div>
          <p className="font-machine text-[19px] tracking-[0.12em] text-[#1a2333]">{numberText}</p>
          <div className="mt-3.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-machine text-[8px] tracking-[0.16em] text-[#5a6472] uppercase">Card holder</p>
              <p className="mt-0.5 truncate font-machine text-[12px] font-semibold tracking-[0.02em] text-[#1a2333] uppercase">
                {holderText}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-machine text-[8px] tracking-[0.16em] text-[#5a6472] uppercase">Expires</p>
              <p className="mt-0.5 font-machine text-[12.5px] font-semibold text-[#1a2333]">{expiryText}</p>
            </div>
            {cvcText !== undefined && (
              <div className="shrink-0 text-right">
                <p className="font-machine text-[8px] tracking-[0.16em] text-[#5a6472] uppercase">CVV</p>
                <p className="mt-0.5 font-machine text-[12.5px] font-semibold text-[#1a2333]">{cvcText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardPreview({
  cardNumber,
  expiry,
  cvc,
  holderName,
  brand,
}: {
  cardNumber: string;
  expiry: string;
  cvc: string;
  holderName: string;
  brand: CardBrand | null;
}) {
  const digits = cardNumber.replace(/\D/g, "");
  const groups = (digits.padEnd(16, "•").match(/.{1,4}/g) ?? []).map((g, i) =>
    i < Math.ceil(digits.length / 4) ? g : "••••",
  );

  return (
    <CardFrame
      brand={brand}
      numberText={groups.join("  ")}
      holderText={holderName || "YOUR NAME"}
      expiryText={expiry || "MM/YY"}
      cvcText={cvc ? "•".repeat(cvc.length) : "•••"}
    />
  );
}

function paymentMethodBrand(brand: PaymentMethod["brand"]): CardBrand | null {
  if (brand === "Visa") return "VISA";
  if (brand === "Mastercard") return "MASTERCARD";
  if (brand === "American Express") return "AMEX";
  return null;
}

function SavedCardPreview({ paymentMethod }: { paymentMethod: PaymentMethod }) {
  return (
    <CardFrame
      brand={paymentMethodBrand(paymentMethod.brand)}
      numberText={`•••• •••• •••• ${paymentMethod.last4}`}
      holderText={paymentMethod.holderName || "—"}
      expiryText={`${String(paymentMethod.expMonth).padStart(2, "0")}/${String(paymentMethod.expYear).slice(-2)}`}
    />
  );
}

function CardTypeIndicator({
  active,
  onSelect,
}: {
  active: CardBrand | null;
  onSelect: (brand: CardBrand) => void;
}) {
  const options: CardBrand[] = ["VISA", "MASTERCARD", "AMEX"];

  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-medium text-ink">Card type</p>
      <p className="mb-2 text-[11px] text-slate">Detected from the number, or pick one directly.</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((id) => {
          const isActive = active === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => onSelect(id)}
              className={[
                "flex items-center justify-between gap-2 border px-2.5 py-2",
                isActive ? "border-signal bg-signal/5" : "border-rule opacity-50 hover:opacity-80",
              ].join(" ")}
            >
              <BrandMark brand={id} small />
              <span
                className={[
                  "flex size-3.5 shrink-0 items-center justify-center border",
                  isActive ? "border-signal" : "border-rule",
                ].join(" ")}
              >
                {isActive && <span className="size-1.5 bg-signal" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddCardForm({
  initialHolderName,
  onAdded,
  onCancel,
}: {
  initialHolderName?: string | undefined;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [holderName, setHolderName] = useState(initialHolderName || getStoredSession()?.user.name || "");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [showCvc, setShowCvc] = useState(false);
  const [manualBrand, setManualBrand] = useState<CardBrand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cardDigits = cardNumber.replace(/\D/g, "");
  const cardNumberComplete = cardDigits.length === 16;
  // Typing a real number is a stronger signal than a prior manual pick, so
  // detection wins once there are digits to detect from; picking a type
  // directly (e.g. before typing) is what drives the icon otherwise.
  const brand = detectBrand(cardDigits) ?? manualBrand;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const match = /^(\d{1,2})\s*\/\s*(\d{2,4})$/.exec(expiry.trim());
    if (!match) {
      setError("Enter expiry as MM/YY.");
      return;
    }
    const expMonth = Number(match[1]);
    const expYear = match[2]!.length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
    setSubmitting(true);
    try {
      await addPaymentMethod({ cardNumber, expMonth, expYear, cvc, holderName });
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="border-t border-rule px-5 py-5" onSubmit={handleSubmit} noValidate>
      {error && (
        <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col gap-4 lg:max-w-[360px]">
          <CardPreview cardNumber={cardNumber} expiry={expiry} cvc={cvc} holderName={holderName} brand={brand} />
          <CardTypeIndicator active={brand} onSelect={setManualBrand} />
        </div>

        <div className="flex-1">
          <Field label="Cardholder name" htmlFor="card-holder">
            <Input
              id="card-holder"
              placeholder="Jane Doe"
              icon={<User className="size-[15px]" />}
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              required
            />
          </Field>
          <div className="mt-3">
            <Field label="Card number" htmlFor="card-number">
              <Input
                id="card-number"
                inputMode="numeric"
                placeholder="4242 4242 4242 4242"
                icon={<CreditCard className="size-[15px]" />}
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                trailing={cardNumberComplete ? <Check className="size-[15px] text-verdict-allow" /> : undefined}
                required
              />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Expiry date" htmlFor="card-expiry">
              <Input
                id="card-expiry"
                inputMode="numeric"
                placeholder="MM/YY"
                icon={<Calendar className="size-[15px]" />}
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                required
              />
            </Field>
            <Field label="CVC" htmlFor="card-cvc">
              <Input
                id="card-cvc"
                type={showCvc ? "text" : "password"}
                inputMode="numeric"
                placeholder="123"
                icon={<Lock className="size-[15px]" />}
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                required
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowCvc((v) => !v)}
                    className="text-slate hover:text-ink"
                    aria-label={showCvc ? "Hide security code" : "Show security code"}
                  >
                    {showCvc ? <EyeOff className="size-[15px]" /> : <Eye className="size-[15px]" />}
                  </button>
                }
              />
            </Field>
          </div>
          <div className="mt-5 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              className="flex-1 border-verdict-block/40 text-verdict-block hover:bg-verdict-block/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={submitting}
              className="flex-1 border-signal text-signal hover:bg-signal/5"
            >
              {submitting ? "Saving…" : initialHolderName ? "Update card" : "Save card"}
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-slate">
            <Lock className="size-[11px]" />
            {initialHolderName
              ? "Saving replaces your existing card. Nothing is charged — any card-shaped number works."
              : "Mock console — nothing is charged. Any card-shaped number works."}
          </p>
        </div>
      </div>
    </form>
  );
}

function UpgradePicker({
  currentPlan,
  hasPaymentMethod,
  onUpgraded,
  onCancel,
}: {
  currentPlan: Plan;
  hasPaymentMethod: boolean;
  onUpgraded: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Plan | null>(null);

  async function handlePick(plan: Plan) {
    setError(null);
    setPending(plan);
    try {
      await upgradePlan(plan);
      onUpgraded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="border-t border-rule px-5 py-4">
      {!hasPaymentMethod && (
        <p role="alert" className="mb-3 border border-verdict-escalate/30 bg-verdict-escalate/10 px-3 py-2 text-[13px] text-ink">
          Add a payment method below before upgrading.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_TIERS.map((tier) => {
          const isCurrent = tier.id === currentPlan;
          return (
            <div key={tier.id} className={`border p-4 ${isCurrent ? "border-signal bg-signal/5" : "border-rule"}`}>
              <p className="text-[13.5px] font-semibold text-ink">{tier.name}</p>
              <p className="mt-1 text-[15px] font-bold text-ink">{tier.priceLabel}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-[12px] text-slate">
                    <Check className="size-[12px] text-verdict-allow" strokeWidth={3} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant={isCurrent ? "secondary" : "primary"}
                className="mt-4 w-full"
                disabled={isCurrent || !hasPaymentMethod || pending !== null}
                onClick={() => handlePick(tier.id)}
              >
                {isCurrent ? "Current plan" : pending === tier.id ? "Upgrading…" : "Choose"}
              </Button>
            </div>
          );
        })}
      </div>
      <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [paymentMethod, setPaymentMethodState] = useState<PaymentMethod | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [viewingCard, setViewingCard] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  async function refresh() {
    const [b, pm] = await Promise.all([getBilling(), getMyPaymentMethod()]);
    setBilling(b);
    setPaymentMethodState(pm);
  }

  useEffect(() => {
    refresh();
    listAgents().then(setAgents);
  }, []);

  async function handleRemoveCard() {
    await removeMyPaymentMethod();
    await refresh();
  }

  const trialDays = billing ? daysRemaining(billing.trialEndsAt) : null;
  const seatPct = billing ? Math.min(100, (billing.seatsUsed / billing.seatsIncluded) * 100) : 0;
  const callVolume24h = agents?.reduce((sum, a) => sum + a.callVolume24h, 0) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-[13.5px] text-slate">Plan, usage and payment for this organization.</p>

      {billing === null ? (
        <p className="mt-6 text-[13px] text-slate">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <Card className="p-0">
            <div className="flex items-start justify-between p-6">
              <div>
                <p className="font-machine text-[10.5px] tracking-[0.14em] text-slate uppercase">
                  Current plan
                </p>
                <p className="mt-1 text-[19px] font-bold text-ink capitalize">{billing.plan}</p>
                {trialDays !== null && (
                  <p className="mt-1 text-[12.5px] text-slate">
                    {trialDays > 0 ? `${trialDays} days left in trial` : "Trial has ended"}
                  </p>
                )}
              </div>
              {!upgrading && (
                <Button variant="secondary" onClick={() => setUpgrading(true)}>
                  Upgrade plan
                </Button>
              )}
            </div>
            {upgrading && (
              <UpgradePicker
                currentPlan={billing.plan}
                hasPaymentMethod={paymentMethod !== null}
                onCancel={() => setUpgrading(false)}
                onUpgraded={async () => {
                  setUpgrading(false);
                  await refresh();
                }}
              />
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">Seats</p>
              <p className="font-machine text-[12px] text-slate">
                {billing.seatsUsed} / {billing.seatsIncluded}
              </p>
            </div>
            <div className="mt-3 h-2 w-full bg-surface-2">
              <div className="h-2 bg-signal" style={{ width: `${seatPct}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-slate">
              {billing.seatsIncluded - billing.seatsUsed} seats remaining on the {billing.plan} plan.
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-[13px] font-semibold text-ink">Usage</p>
            <p className="mt-3 text-[24px] font-bold text-ink">
              {callVolume24h === null ? "…" : callVolume24h.toLocaleString()}
            </p>
            <p className="text-[12px] text-slate">Agent calls mediated in the last 24 hours, across {agents?.length ?? "…"} agents.</p>
          </Card>

          <Card className="p-0">
            <div className="border-b border-rule px-5 py-3">
              <p className="text-[13px] font-semibold text-ink">Payment method</p>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center bg-surface-2 text-slate">
                  <CreditCard className="size-[16px]" />
                </span>
                <p className="text-[13px] text-slate">
                  {paymentMethod
                    ? `${paymentMethod.brand} •••• ${paymentMethod.last4} · expires ${String(paymentMethod.expMonth).padStart(2, "0")}/${String(paymentMethod.expYear).slice(-2)}`
                    : "No payment method on file."}
                </p>
              </div>
              {paymentMethod ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingCard(true)}
                    className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:text-ink"
                  >
                    <Eye className="size-[13px]" /> View
                  </button>
                  <button
                    onClick={() => setAddingCard((v) => !v)}
                    className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:text-ink"
                  >
                    <Pencil className="size-[13px]" /> Edit
                  </button>
                  <button
                    onClick={handleRemoveCard}
                    className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
                  >
                    <Trash2 className="size-[13px]" /> Remove
                  </button>
                </div>
              ) : (
                !addingCard && (
                  <Button variant="secondary" size="sm" onClick={() => setAddingCard(true)}>
                    Add payment method
                  </Button>
                )
              )}
            </div>
            {addingCard && (
              <AddCardForm
                initialHolderName={paymentMethod?.holderName}
                onCancel={() => setAddingCard(false)}
                onAdded={async () => {
                  setAddingCard(false);
                  await refresh();
                }}
              />
            )}
            {viewingCard && paymentMethod && (
              <Modal title="Payment method" subtitle="Read-only — use Edit to change it." onClose={() => setViewingCard(false)}>
                <SavedCardPreview paymentMethod={paymentMethod} />
              </Modal>
            )}
          </Card>

          <Card className="p-6">
            <p className="text-[13px] font-semibold text-ink">Invoices</p>
            <p className="mt-2 text-[13px] text-slate">
              No invoices yet — this organization hasn't been billed. Invoices will appear here once a
              paid plan starts.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
