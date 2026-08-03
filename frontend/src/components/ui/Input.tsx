import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; trailing?: ReactNode; invalid?: boolean }
>(function Input({ icon, trailing, invalid, className = "", ...props }, ref) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={[
          "h-11 w-full rounded-[var(--radius-control)] border bg-paper text-[15px] text-ink placeholder:text-slate/70",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "focus:outline-none focus:ring-2 focus:ring-signal/30",
          invalid ? "border-verdict-block" : "border-rule focus:border-signal",
          icon ? "pl-10" : "pl-3.5",
          trailing ? "pr-10" : "pr-3.5",
          className,
        ].join(" ")}
        {...props}
      />
      {trailing && <span className="absolute inset-y-0 right-0 flex items-center pr-3">{trailing}</span>}
    </div>
  );
});
