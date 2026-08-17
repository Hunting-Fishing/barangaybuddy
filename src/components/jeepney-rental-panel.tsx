import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  formatDayDate,
  formatPhpAmount,
  rentalEventLabel,
  type RentalRequest,
} from "@/lib/jeepney";

type Props = {
  routeId: string | null;
  rentalAvailable: boolean;
  dayRate: string;
  rentalNote: string;
  onAvailableChange: (v: boolean) => void;
  onDayRateChange: (v: string) => void;
  onNoteChange: (v: string) => void;
};

/** Operator side: rental availability settings plus incoming booking requests. */
export function JeepneyRentalPanel({
  routeId,
  rentalAvailable,
  dayRate,
  rentalNote,
  onAvailableChange,
  onDayRateChange,
  onNoteChange,
}: Props) {
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [replies, setReplies] = useState<Record<string, { reply: string; quote: string }>>({});

  useEffect(() => {
    if (!routeId) return;
    void load(routeId);
  }, [routeId]);

  async function load(id: string) {
    const { data } = await supabase
      .from("jeepney_rental_requests")
      .select("*")
      .eq("route_id", id)
      .order("event_date", { ascending: true });
    setRequests((data ?? []) as RentalRequest[]);
  }

  async function respond(request: RentalRequest, status: "accepted" | "declined") {
    const draft = replies[request.id];
    const { error } = await supabase
      .from("jeepney_rental_requests")
      .update({
        status,
        operator_reply: draft?.reply?.trim() || null,
        quoted_php: draft?.quote ? Number(draft.quote) : null,
      })
      .eq("id", request.id);
    if (error) {
      toast.error("Could not update that request.");
      return;
    }
    toast.success(status === "accepted" ? "Booking accepted." : "Booking declined.");
    if (routeId) void load(routeId);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="rental-on" className="text-sm font-semibold">
              Available for rent
            </Label>
            <p className="text-xs text-muted-foreground">
              Let riders book this jeepney for weddings, fiestas and other functions.
            </p>
          </div>
          <Switch id="rental-on" checked={rentalAvailable} onCheckedChange={onAvailableChange} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rental-rate">Day rate (₱)</Label>
            <Input
              id="rental-rate"
              type="number"
              min="0"
              className="h-9"
              value={dayRate}
              onChange={(e) => onDayRateChange(e.target.value)}
              placeholder="4500"
              disabled={!rentalAvailable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rental-note">Rental note</Label>
            <Input
              id="rental-note"
              className="h-9"
              value={rentalNote}
              onChange={(e) => onNoteChange(e.target.value.slice(0, 200))}
              placeholder="Fuel included within the city, minimum 4 hours"
              disabled={!rentalAvailable}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Booking requests</p>
        {!routeId && (
          <p className="text-xs text-muted-foreground">Save the route to start taking bookings.</p>
        )}
        {routeId && requests.length === 0 && (
          <p className="text-xs text-muted-foreground">No booking requests yet.</p>
        )}
        {requests.map((r) => (
          <div key={r.id} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {rentalEventLabel(r.event_type)} · {formatDayDate(r.event_date)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.contact_name} · {r.contact_phone}
                  {r.passengers ? ` · ${r.passengers} passengers` : ""}
                  {r.hours ? ` · ${r.hours} hrs` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pickup: {r.pickup_address}
                  {r.dropoff_address ? ` → ${r.dropoff_address}` : ""}
                </p>
                {r.message && <p className="mt-1 text-xs">{r.message}</p>}
              </div>
              <Badge variant={r.status === "accepted" ? "default" : "secondary"}>{r.status}</Badge>
            </div>

            {r.status === "pending" ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                  <Input
                    type="number"
                    className="h-8"
                    placeholder="Quote ₱"
                    value={replies[r.id]?.quote ?? ""}
                    onChange={(e) =>
                      setReplies((prev) => ({
                        ...prev,
                        [r.id]: { reply: prev[r.id]?.reply ?? "", quote: e.target.value },
                      }))
                    }
                  />
                  <Textarea
                    className="min-h-[2.25rem]"
                    placeholder="Reply to the rider"
                    value={replies[r.id]?.reply ?? ""}
                    onChange={(e) =>
                      setReplies((prev) => ({
                        ...prev,
                        [r.id]: { quote: prev[r.id]?.quote ?? "", reply: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => respond(r, "accepted")}>
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => respond(r, "declined")}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {r.quoted_php ? `Quoted ${formatPhpAmount(r.quoted_php)}. ` : ""}
                {r.operator_reply ?? ""}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
