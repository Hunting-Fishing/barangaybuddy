import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  CALENDAR_KINDS,
  calendarKindColour,
  calendarKindLabel,
  formatDayDate,
  isoDate,
  type CalendarEntry,
  type CalendarKind,
} from "@/lib/jeepney";

type Props = {
  routeId: string | null;
  /** Operators can add and remove entries; riders only read them. */
  canEdit?: boolean;
};

/** Maintenance days, breakdowns, holidays and other service notices. */
export function JeepneyServiceCalendar({ routeId, canEdit = false }: Props) {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(routeId));
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState("");
  const [kind, setKind] = useState<CalendarKind>("maintenance");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!routeId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    void load(routeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  async function load(id: string) {
    setLoading(true);
    const { data } = await supabase
      .from("jeepney_route_calendar")
      .select("id, route_id, entry_date, end_date, kind, title, note, not_running")
      .eq("route_id", id)
      .gte("entry_date", isoDate(new Date(Date.now() - 30 * 86400000)))
      .order("entry_date", { ascending: true });
    setEntries((data ?? []) as CalendarEntry[]);
    setLoading(false);
  }

  async function addEntry() {
    if (!routeId || !date) return;
    if (title.trim().length < 3) {
      toast.error("Give this a short title, e.g. “Engine overhaul”.");
      return;
    }
    setSaving(true);
    const notRunning = CALENDAR_KINDS.find((k) => k.value === kind)?.notRunning ?? false;
    const { error } = await supabase.from("jeepney_route_calendar").insert({
      route_id: routeId,
      entry_date: isoDate(date),
      end_date: endDate || null,
      kind,
      title: title.trim(),
      note: note.trim() || null,
      not_running: notRunning,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save that calendar entry. Please try again.");
      return;
    }
    setTitle("");
    setNote("");
    setEndDate("");
    toast.success("Added to your service calendar — riders will see it.");
    void load(routeId);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("jeepney_route_calendar").delete().eq("id", id);
    if (error) {
      toast.error("Could not remove that entry.");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const marked = entries.map((e) => new Date(`${e.entry_date}T00:00:00`));

  if (!routeId) {
    return (
      <p className="text-xs text-muted-foreground">
        Save the route first, then you can mark maintenance days, breakdowns and holiday schedules
        here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          modifiers={{ marked }}
          modifiersClassNames={{ marked: "bg-primary/15 font-bold rounded-md" }}
          className="pointer-events-auto rounded-md border border-border p-3"
        />

        {canEdit && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>What is happening?</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CalendarKind)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[2100]">
                  {CALENDAR_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cal-title">Title</Label>
                <Input
                  id="cal-title"
                  className="h-9"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                  placeholder="Engine overhaul"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cal-end">Until (optional)</Label>
                <Input
                  id="cal-end"
                  className="h-9"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="Details riders should know — replacement jeepney, shorter hours, etc."
            />
            <Button type="button" onClick={addEntry} disabled={saving || !date}>
              <Plus className="mr-1.5 h-4 w-4" />
              {saving ? "Saving…" : `Add for ${date ? formatDayDate(isoDate(date)) : "…"}`}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Upcoming and recent</p>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing on the calendar yet.</p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between gap-2 rounded-md border border-border p-2"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: calendarKindColour(entry.kind) }}
                />
                {entry.title}
                {entry.not_running && (
                  <Badge variant="secondary" className="text-[10px]">
                    No trips
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDayDate(entry.entry_date)}
                {entry.end_date ? ` – ${formatDayDate(entry.end_date)}` : ""} ·{" "}
                {calendarKindLabel(entry.kind)}
              </p>
              {entry.note && <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>}
            </div>
            {canEdit && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={`Remove ${entry.title}`}
                onClick={() => remove(entry.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
