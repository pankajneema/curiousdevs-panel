import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, CreditCard, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  addPaymentMethod,
  getBilling,
  getMyPaymentMethod,
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

function detectBrandLabel(digits: string): string {
  if (digits.startsWith("34") || digits.startsWith("37")) return "AMEX";
  if (digits.startsWith("5")) return "MASTERCARD";
  if (digits.startsWith("4")) return "VISA";
  return "CARD";
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return (digits.match(/.{1,4}/g) ?? []).join(" ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function CardPreview({ cardNumber, expiry, cvc }: { cardNumber: string; expiry: string; cvc: string }) {
  const digits = cardNumber.replace(/\D/g, "");
  const groups = (digits.padEnd(16, "•").match(/.{1,4}/g) ?? []).map((g, i) =>
    i < Math.ceil(digits.length / 4) ? g : "••••",
  );
  const brand = digits.length > 0 ? detectBrandLabel(digits) : "CARD";

  return (
    <div className="relative flex aspect-[1.586/1] w-full max-w-[340px] flex-col justify-between bg-ink p-5 text-paper">
      <div className="flex items-start justify-between">
        <span className="size-7 border border-[var(--wordmark-silver)]/60" />
        <span className="font-machine text-[13px] font-bold tracking-wide">{brand}</span>
      </div>
      <div>
        <p className="font-machine text-[17px] tracking-[0.12em]">{groups.join("  ")}</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="font-machine text-[8.5px] tracking-[0.14em] text-[var(--wordmark-silver)] uppercase">Expires</p>
            <p className="font-machine text-[12px]">{expiry || "MM/YY"}</p>
          </div>
          <div>
            <p className="font-machine text-[8.5px] tracking-[0.14em] text-[var(--wordmark-silver)] uppercase">CVC</p>
            <p className="font-machine text-[12px]">{cvc ? "•".repeat(cvc.length) : "•••"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddCardForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      await addPaymentMethod({ cardNumber, expMonth, expYear, cvc });
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="border-t border-rule px-5 py-4" onSubmit={handleSubmit} noValidate>
      {error && (
        <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <CardPreview cardNumber={cardNumber} expiry={expiry} cvc={cvc} />
        <div className="flex-1">
          <Field label="Card number" htmlFor="card-number">
            <Input
              id="card-number"
              inputMode="numeric"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              required
            />
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Expiry" htmlFor="card-expiry">
              <Input
                id="card-expiry"
                inputMode="numeric"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                required
              />
            </Field>
            <Field label="CVC" htmlFor="card-cvc">
              <Input
                id="card-cvc"
                inputMode="numeric"
                placeholder="123"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                required
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving…" : "Save card"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] text-slate">
        Mock console — nothing is charged. Any card-shaped number works.
      </p>
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
    <div className="mx-auto max-w-2xl px-6 py-8">
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
                <button
                  onClick={handleRemoveCard}
                  className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
                >
                  <Trash2 className="size-[13px]" /> Remove
                </button>
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
                onCancel={() => setAddingCard(false)}
                onAdded={async () => {
                  setAddingCard(false);
                  await refresh();
                }}
              />
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
