import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90 border border-transparent",
  secondary: "bg-paper text-ink border border-rule hover:bg-surface-2",
  ghost: "bg-transparent text-slate hover:text-ink hover:bg-surface-2 border border-transparent",
  destructive: "bg-verdict-block text-paper hover:bg-verdict-block/90 border border-transparent",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ variant = "primary", size = "md", className = "", disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium",
        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(" ")}
      {...props}
    />
  );
});
