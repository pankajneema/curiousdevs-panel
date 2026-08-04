export function KpiCard({
  label,
  value,
  sublabel,
  accentClass,
  active,
  onClick,
}: {
  label: string;
  value: number;
  sublabel: string;
  accentClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "border-l-2 border-y border-r border-rule bg-paper p-5 text-left shadow-[var(--shadow-1)]",
        accentClass,
        active ? "ring-1 ring-signal/30" : "",
      ].join(" ")}
    >
      <p className="font-machine text-[10px] tracking-[0.14em] text-slate uppercase">{label}</p>
      <p className="mt-1.5 text-[26px] font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11.5px] text-slate">{sublabel}</p>
    </button>
  );
}
