import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1 text-[12.5px] text-ink">
          <CircleAlert className="mt-0.5 size-[13px] shrink-0 text-verdict-block" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-slate">{hint}</p>
      ) : null}
    </div>
  );
}
