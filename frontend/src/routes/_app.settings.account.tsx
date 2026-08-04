import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getStoredSession } from "@/lib/api";
import { formatDate, formatTime, usePreferences } from "@/lib/preferences";

export const Route = createFileRoute("/_app/settings/account")({
  component: AccountPage,
});

function Row({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-3.5 last:border-0">
      <span className="text-[13px] text-slate">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`text-[13px] text-ink ${mono ? "font-machine" : ""}`}>{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${label}`}
            className="flex size-6 items-center justify-center text-slate hover:text-ink"
          >
            {copied ? <Check className="size-[13px] text-verdict-allow" /> : <Copy className="size-[13px]" />}
          </button>
        )}
      </span>
    </div>
  );
}

const roleLabel: Record<string, string> = {
  owner: "Owner",
  security_admin: "Security admin",
  approver: "Approver",
  viewer: "Viewer",
};

function AccountPage() {
  const session = getStoredSession()!;
  const { preferences } = usePreferences();

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-[13.5px] text-slate">Identity and account metadata — read-only.</p>

      <Card className="mt-6 p-0">
        <Row label="User ID" value={session.user.id} mono copyable />
        <Row label="Role" value={roleLabel[session.user.role] ?? session.user.role} />
        <Row label="Organization" value={session.organization.name} />
        <Row
          label="Created"
          value={`${formatDate(session.user.createdAt, preferences)} at ${formatTime(session.user.createdAt, preferences)}`}
        />
        <Row
          label="Last active"
          value={
            session.user.lastActiveAt
              ? `${formatDate(session.user.lastActiveAt, preferences)} at ${formatTime(session.user.lastActiveAt, preferences)}`
              : "Never"
          }
        />
      </Card>
    </div>
  );
}
