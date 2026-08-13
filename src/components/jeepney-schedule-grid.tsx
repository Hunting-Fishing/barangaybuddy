import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DaySchedule } from "@/lib/jeepney";

type Props = {
  schedule: DaySchedule[];
  defaults: { first_run: string; last_run: string; last_pickup: string };
  onChange: (schedule: DaySchedule[]) => void;
};

/** Monday-to-Sunday grid with the running times beside each day. */
export function JeepneyScheduleGrid({ schedule, defaults, onChange }: Props) {
  function update(day: string, patch: Partial<DaySchedule>) {
    onChange(schedule.map((row) => (row.day === day ? { ...row, ...patch } : row)));
  }

  function copyDown(day: string) {
    const source = schedule.find((r) => r.day === day);
    if (!source) return;
    onChange(
      schedule.map((row) => ({
        ...row,
        first_run: source.first_run,
        last_run: source.last_run,
        last_pickup: source.last_pickup,
      })),
    );
  }

  return (
    <div className="space-y-2">
      <div className="hidden gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[6.5rem_5rem_1fr_1fr_1fr]">
        <span>Day</span>
        <span>Running</span>
        <span>First run</span>
        <span>Last run</span>
        <span>Last pickup</span>
      </div>

      {schedule.map((row) => (
        <div
          key={row.day}
          className="grid items-center gap-2 rounded-md border border-border p-2 sm:grid-cols-[6.5rem_5rem_1fr_1fr_1fr]"
        >
          <span className="text-sm font-semibold">{row.day}</span>
          <div className="flex items-center gap-2">
            <Switch
              id={`day-${row.day}`}
              checked={row.active}
              onCheckedChange={(v) => update(row.day, { active: v })}
            />
            <Label htmlFor={`day-${row.day}`} className="text-xs text-muted-foreground sm:sr-only">
              {row.active ? "Running" : "No trips"}
            </Label>
          </div>
          <Input
            type="time"
            aria-label={`${row.day} first run`}
            className="h-8"
            value={row.first_run ?? ""}
            placeholder={defaults.first_run}
            disabled={!row.active}
            onChange={(e) => update(row.day, { first_run: e.target.value || null })}
          />
          <Input
            type="time"
            aria-label={`${row.day} last run`}
            className="h-8"
            value={row.last_run ?? ""}
            disabled={!row.active}
            onChange={(e) => update(row.day, { last_run: e.target.value || null })}
          />
          <div className="flex items-center gap-1">
            <Input
              type="time"
              aria-label={`${row.day} last pickup`}
              className="h-8"
              value={row.last_pickup ?? ""}
              disabled={!row.active}
              onChange={(e) => update(row.day, { last_pickup: e.target.value || null })}
            />
            <button
              type="button"
              className="shrink-0 text-[11px] text-primary underline-offset-2 hover:underline"
              onClick={() => copyDown(row.day)}
            >
              Copy to all
            </button>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Blank times fall back to the route default ({defaults.first_run}–{defaults.last_run}).
      </p>
    </div>
  );
}
