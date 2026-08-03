import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "rounded-[var(--radius-panel)] border border-rule bg-paper shadow-[var(--shadow-1)]",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
