import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { slugifyTeam, type GroupRow } from "@/lib/groups";
import { Loader2, Search, UserPlus, X, ShieldCheck } from "lucide-react";

type Barangay = { code: string; name: string; city_code: string };
type PlayerHit = { id: string; display_name: string | null; avatar_url: string | null };

export function TeamRegistrationDialog({
  group,
  onCreated,
  disabled,
  disabledReason,
}: {
  group: GroupRow;
  onCreated: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // barangay search
  const [brgyQuery, setBrgyQuery] = useState("");
  const [brgyHits, setBrgyHits] = useState<Barangay[]>([]);
  const [barangay, setBarangay] = useState<Barangay | null>(null);

  // roster search
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerHits, setPlayerHits] = useState<PlayerHit[]>([]);
  const [roster, setRoster] = useState<PlayerHit[]>([]);

  useEffect(() => {
    if (barangay || brgyQuery.trim().length < 2) {
      setBrgyHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("barangays")
        .select("code, name, city_code")
        .ilike("name", `%${brgyQuery.trim()}%`)
        .limit(8);
      setBrgyHits((data ?? []) as Barangay[]);
    }, 250);
    return () => clearTimeout(t);
  }, [brgyQuery, barangay]);

  useEffect(() => {
    if (playerQuery.trim().length < 2) {
      setPlayerHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .ilike("display_name", `%${playerQuery.trim()}%`)
        .limit(8);
      setPlayerHits((data ?? []) as PlayerHit[]);
    }, 250);
    return () => clearTimeout(t);
  }, [playerQuery]);

  function addPlayer(p: PlayerHit) {
    if (p.id === user?.id) return toast.info("You're already the team captain.");
    if (roster.some((r) => r.id === p.id)) return;
    if (roster.length >= 11) return toast.error("Maximum 12 players including the captain.");
    setRoster((r) => [...r, p]);
    setPlayerQuery("");
    setPlayerHits([]);
  }

  async function submit() {
    if (!user) return toast.error("Sign in first.");
    if (name.trim().length < 3) return toast.error("Enter a team name.");
    if (!barangay) return toast.error("Choose the barangay your team represents.");

    setSubmitting(true);
    const anyDb = supabase as any;
    const { data: team, error } = await anyDb
      .from("group_teams")
      .insert({
        group_id: group.id,
        name: name.trim(),
        slug: `${slugifyTeam(name)}-${Math.random().toString(36).slice(2, 6)}`,
        barangay_code: barangay.code,
        city_code: barangay.city_code,
        captain_id: user.id,
        contact_phone: phone.trim() || null,
        notes: notes.trim() || null,
        status: "pending",
      })
      .select("*")
      .single();

    if (error || !team) {
      setSubmitting(false);
      toast.error(error?.message ?? "Could not register the team.");
      return;
    }

    const rows = [
      {
        team_id: team.id,
        user_id: user.id,
        is_captain: true,
        status: "confirmed",
        invited_by: user.id,
      },
      ...roster.map((p) => ({
        team_id: team.id,
        user_id: p.id,
        is_captain: false,
        status: "invited",
        invited_by: user.id,
      })),
    ];
    const { error: rosterErr } = await anyDb.from("group_team_members").insert(rows);
    setSubmitting(false);
    if (rosterErr) {
      toast.error(`Team created, but roster failed: ${rosterErr.message}`);
    } else {
      toast.success("Team submitted. A league admin will review and approve it.");
    }
    setOpen(false);
    setName("");
    setRoster([]);
    setBarangay(null);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} title={disabledReason}>
          <UserPlus className="mr-2 h-4 w-4" /> Register a team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register your team</DialogTitle>
          <DialogDescription>
            You are the team captain. Every player must already have a Barangay Buddy account and
            an active player membership before the league approves the roster.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="tname">Team name</Label>
            <Input
              id="tname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brgy. Poblacion Breakers"
            />
          </div>

          <div>
            <Label>Barangay represented</Label>
            {barangay ? (
              <div className="mt-1.5 flex items-center gap-2">
                <Badge variant="secondary">{barangay.name}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setBarangay(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mt-1.5">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={brgyQuery}
                    onChange={(e) => setBrgyQuery(e.target.value)}
                    placeholder="Search barangay name"
                  />
                </div>
                {brgyHits.length > 0 && (
                  <div className="mt-1 overflow-hidden rounded-lg border border-border">
                    {brgyHits.map((b) => (
                      <button
                        key={b.code}
                        type="button"
                        onClick={() => {
                          setBarangay(b);
                          setBrgyQuery("");
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Captain contact number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
            />
          </div>

          <div>
            <Label>Team members (registered app users)</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                placeholder="Search players by name"
              />
            </div>
            {playerHits.length > 0 && (
              <div className="mt-1 overflow-hidden rounded-lg border border-border">
                {playerHits.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPlayer(p)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {p.display_name ?? "Player"}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary">
                <ShieldCheck className="mr-1 h-3 w-3" /> You (captain)
              </Badge>
              {roster.map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1">
                  {p.display_name ?? "Player"}
                  <button
                    type="button"
                    onClick={() => setRoster((r) => r.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.display_name ?? "player"}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Players you add get an invite on their dashboard. They must accept and hold an active
              ₱{group.membership_fee_php} player membership to be eligible to compete.
            </p>
          </div>

          <div>
            <Label htmlFor="notes">Notes for the league admin (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Home venue, preferred playing nights, sponsor, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
