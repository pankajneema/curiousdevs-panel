import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-md",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${maxWidthClass} border border-rule bg-paper shadow-[var(--shadow-2)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-3.5">
          <div>
            <p className="text-[14px] font-semibold text-ink">{title}</p>
            {subtitle && <p className="mt-0.5 text-[12px] text-slate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 shrink-0 items-center justify-center text-slate hover:text-ink"
            aria-label="Close"
          >
            <X className="size-[16px]" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-rule px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  );
}
