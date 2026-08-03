import type { ComponentType } from "react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-start px-6 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">{title}</h1>
      <div className="mt-8 flex w-full flex-col items-center gap-3 border border-dashed border-rule px-6 py-16 text-center">
        <span className="flex size-11 items-center justify-center bg-surface-2 text-slate">
          <Icon className="size-[20px]" />
        </span>
        <p className="max-w-md text-[13.5px] leading-relaxed text-slate">{description}</p>
      </div>
    </div>
  );
}
