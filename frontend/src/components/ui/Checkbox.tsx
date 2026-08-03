import { type InputHTMLAttributes, forwardRef } from "react";
import { Check } from "lucide-react";

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string }
>(function Checkbox({ label, className = "", id, ...props }, ref) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 select-none">
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={["peer size-4 shrink-0 appearance-none border border-rule bg-paper", "checked:border-signal checked:bg-signal", "focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2", className].join(" ")}
          {...props}
        />
        <Check className="pointer-events-none absolute size-3 text-paper opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      <span className="text-[13.5px] text-ink">{label}</span>
    </label>
  );
});
