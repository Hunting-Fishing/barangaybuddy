import { useState } from "react";
import { toast } from "sonner";
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
import { useAuth } from "@/hooks/use-auth";
import { useGroupCreateForm } from "@/hooks/use-group-create-form";
import { GroupFormAbout } from "@/components/group-form-about";
import { GroupFormMembership } from "@/components/group-form-membership";
import { GroupFormPayments } from "@/components/group-form-payments";
import { Check, Loader2, Plus } from "lucide-react";

const STEPS = [
  { id: 1, label: "About your group" },
  { id: 2, label: "Membership" },
  { id: 3, label: "Contact & payments" },
] as const;

export function GroupCreateDialog({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { form, update, step, setStep, next, back, submitting, submit, reset } =
    useGroupCreateForm(onSubmitted);

  async function handleSubmit() {
    if (!user) {
      toast.error("Sign in to apply for a group listing.");
      return;
    }
    const ok = await submit(user.id);
    if (ok) setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add a group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add your club or league</DialogTitle>
          <DialogDescription>
            Tell us about your group and how members join. Every application is reviewed before it
            goes live on the directory.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2">
          {STEPS.map((s) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <li key={s.id} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => (s.id < step ? setStep(s.id) : undefined)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.id}
                </button>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
                {s.id !== 3 && <span className="h-px flex-1 bg-border" />}
              </li>
            );
          })}
        </ol>

        <div className="pt-2">
          {step === 1 && <GroupFormAbout form={form} update={update} />}
          {step === 2 && <GroupFormMembership form={form} update={update} />}
          {step === 3 && <GroupFormPayments form={form} update={update} />}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? setOpen(false) : back())}
            disabled={submitting}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for review
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
