import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";

type Props = { routeId: string; routeName: string; onSubmitted?: () => void };

export function JeepneyClaimDialog({ routeId, routeName, onSubmitted }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [operatorName, setOperatorName] = useState("");
  const [phone, setPhone] = useState("");
  const [bodyNumber, setBodyNumber] = useState("");
  const [franchise, setFranchise] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function upload(file: File, kind: string) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user!.id}/${routeId}-${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("jeepney-claims").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  }

  async function submit() {
    if (!user) {
      toast.error("Sign in first so we can link this jeepney to your account.");
      return;
    }
    if (operatorName.trim().length < 3) return toast.error("Enter your operator or association name.");
    if (bodyNumber.trim().length < 2) return toast.error("Enter the body or plate number on your jeepney.");
    if (!photo) return toast.error("Add a photo of the jeepney showing its number.");

    setSaving(true);
    try {
      const photoPath = await upload(photo, "jeepney");
      const documentPath = document ? await upload(document, "document") : null;
      const { error } = await supabase.from("jeepney_route_claims").insert({
        route_id: routeId,
        user_id: user.id,
        operator_name: operatorName.trim(),
        contact_phone: phone.trim() || null,
        body_number: bodyNumber.trim(),
        franchise_number: franchise.trim() || null,
        photo_path: photoPath,
        document_path: documentPath,
      });
      if (error) throw new Error(error.message);
      toast.success("Claim submitted — we'll review your photo and get back to you.");
      setOpen(false);
      onSubmitted?.();
    } catch (e) {
      toast.error(`Could not submit the claim: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BadgeCheck className="mr-1.5 h-4 w-4" /> Claim this route
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claim “{routeName}”</DialogTitle>
          <DialogDescription>
            Show us your jeepney and we'll hand this route to you — then you can set your times,
            fares and go live. Every claim is checked by our team first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="jc-op">Operator or association name</Label>
            <Input id="jc-op" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jc-body">Jeepney body / plate number</Label>
              <Input
                id="jc-body"
                value={bodyNumber}
                onChange={(e) => setBodyNumber(e.target.value)}
                placeholder="e.g. ABC 1234 / body no. 12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jc-fr">Franchise / LTFRB case number</Label>
              <Input id="jc-fr" value={franchise} onChange={(e) => setFranchise(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-phone">Contact number</Label>
            <Input id="jc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxxx" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-photo">Photo of the jeepney (number must be readable)</Label>
            <Input
              id="jc-photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-doc">Franchise or OR/CR photo (optional)</Label>
            <Input
              id="jc-doc"
              type="file"
              accept="image/*"
              onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your photos are private — only our review team can open them.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Submitting…" : "Submit claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
