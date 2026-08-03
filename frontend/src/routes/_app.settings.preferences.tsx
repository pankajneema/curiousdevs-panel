import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/Card";
import { usePreferences, type DateFormat, type Density, type TimeFormat } from "@/lib/preferences";

export const Route = createFileRoute("/_app/settings/preferences")({
  component: PreferencesPage,
});

function OptionRow({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4 last:border-0">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        <p className="text-[12px] text-slate">{description}</p>
      </div>
      <div className="flex border border-rule">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={[
              "px-3 py-1.5 text-[12.5px] font-medium not-last:border-r not-last:border-rule",
              value === opt.value ? "bg-ink text-paper" : "bg-paper text-slate hover:text-ink",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreferencesPage() {
  const { preferences, setPreferences } = usePreferences();

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-[13.5px] text-slate">How the console looks and behaves for you, on this device.</p>

      <Card className="mt-6 p-0">
        <OptionRow
          label="Density"
          description="How much room lists and tables get."
          value={preferences.density}
          onChange={(v) => setPreferences({ density: v as Density })}
          options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ]}
        />
        <OptionRow
          label="Sidebar"
          description="Collapse the sidebar to icons only."
          value={preferences.sidebarCollapsed ? "collapsed" : "expanded"}
          onChange={(v) => setPreferences({ sidebarCollapsed: v === "collapsed" })}
          options={[
            { value: "expanded", label: "Expanded" },
            { value: "collapsed", label: "Collapsed" },
          ]}
        />
        <OptionRow
          label="Date format"
          description="Used everywhere a date is shown."
          value={preferences.dateFormat}
          onChange={(v) => setPreferences({ dateFormat: v as DateFormat })}
          options={[
            { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
            { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
            { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
          ]}
        />
        <OptionRow
          label="Time format"
          description="Used everywhere a time is shown."
          value={preferences.timeFormat}
          onChange={(v) => setPreferences({ timeFormat: v as TimeFormat })}
          options={[
            { value: "12h", label: "12-hour" },
            { value: "24h", label: "24-hour" },
          ]}
        />
      </Card>

      <p className="mt-3 text-[12px] text-slate">
        Default landing dashboard and currency aren't here yet — there's only one dashboard today, and no
        priced usage to display currency against.
      </p>
    </div>
  );
}
