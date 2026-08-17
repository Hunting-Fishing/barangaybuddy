import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarHeart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RENTAL_EVENT_TYPES, formatPhpAmount } from "@/lib/jeepney";

type Props = {
  routeId: string;
  routeName: string;
  dayRatePhp?: number | null;
  rentalNote?: string | null;
};

/** Rider-facing "book this jeepney for an event" request form. */
export function JeepneyRentalDialog({ routeId, routeName, dayRatePhp, rentalNote }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState("wedding");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [hours, setHours] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [passengers, setPassengers] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!user) return;
    if (!eventDate) {
      toast.error("Pick the date you need the jeepney.");
      return;
    }
    if (pickup.trim().length < 4) {
      toast.error("Where should the jeepney pick you up?");
      return;
    }
    if (contactName.trim().length < 2 || phone.trim().length < 7) {
      toast.error("Add your name and a mobile number so the operator can reply.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("jeepney_rental_requests").insert({
      route_id: routeId,
      user_id: user.id,
      event_type: eventType,
      event_date: eventDate,
      start_time: startTime || null,
      hours: hours ? Number(hours) : null,
      pickup_address: pickup.trim(),
      dropoff_address: dropoff.trim() || null,
      passengers: passengers ? Number(passengers) : null,
      contact_name: contactName.trim(),
      contact_phone: phone.trim(),
      message: message.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not send your request. Please try again.");
      return;
    }
    setOpen(false);
    toast.success("Request sent — the operator will contact you to confirm.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarHeart className="mr-1.5 h-4 w-4" /> Book this jeepney
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[2000] max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book {routeName}</DialogTitle>
          <DialogDescription>
            Hire this jeepney for a wedding, fiesta, school trip or any function.
            {dayRatePhp ? ` Day rate around ${formatPhpAmount(dayRatePhp)}.` : ""}
          </DialogDescription>
        </DialogHeader>

        {rentalNote && <p className="text-xs text-muted-foreground">{rentalNote}</p>}

        {!user ? (
          <div className="space-y-3 text-sm">
            <p>Sign in so the operator can reply to your booking.</p>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Occasion</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[2100]">
                    {RENTAL_EVENT_TYPES.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rent-date">Date needed</Label>
                <Input
                  id="rent-date"
                  type="date"
                  className="h-9"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rent-time">Pickup time</Label>
                <Input
                  id="rent-time"
                  type="time"
                  className="h-9"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rent-hours">Hours needed</Label>
                <Input
                  id="rent-hours"
                  type="number"
                  min="1"
                  className="h-9"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="6"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rent-pickup">Pickup address</Label>
              <Input
                id="rent-pickup"
                className="h-9"
                value={pickup}
                onChange={(e) => setPickup(e.target.value.slice(0, 160))}
                placeholder="Barangay hall, Sto. Niño"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rent-drop">Drop-off address (optional)</Label>
              <Input
                id="rent-drop"
                className="h-9"
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value.slice(0, 160))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rent-pax">Passengers</Label>
                <Input
                  id="rent-pax"
                  type="number"
                  min="1"
                  className="h-9"
                  value={passengers}
                  onChange={(e) => setPassengers(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rent-name">Your name</Label>
                <Input
                  id="rent-name"
                  className="h-9"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value.slice(0, 80))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rent-phone">Mobile number</Label>
                <Input
                  id="rent-phone"
                  className="h-9"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                  placeholder="09XX XXX XXXX"
                />
              </div>
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 400))}
              placeholder="Anything else — decorations, extra stops, sound system…"
            />
          </div>
        )}

        {user && (
          <DialogFooter>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Sending…" : "Send booking request"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
