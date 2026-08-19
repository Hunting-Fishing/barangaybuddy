import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_PRESETS, type GroupApplicationForm } from "@/lib/group-application";
import { formatPhp } from "@/lib/groups";

const BENEFIT_SUGGESTIONS = [
  "Weekly league nights",
  "Tournament entry",
  "Member discounts at partner venues",
  "Team jersey",
  "Coaching / clinics",
  "Ranking & stats tracking",
  "Trophies & prize pool",
  "Group chat & announcements",
  "Free practice hours",
  "Guest passes",
];

type Props = {
  form: GroupApplicationForm;
  update: <K extends keyof GroupApplicationForm>(key: K, value: GroupApplicationForm[K]) => void;
};

export function GroupFormMembership({ form, update }: Props) {
  const fee = Number(form.membership_fee_php) || 0;
  const days = Number(form.membership_period_days) || 365;

  function toggleBenefit(benefit: string) {
    const has = form.benefits.includes(benefit);
    update(
      "benefits",
      has ? form.benefits.filter((b) => b !== benefit) : [...form.benefits, benefit],
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
        <div>
          <Label htmlFor="group-paid" className="text-sm font-semibold">
            Charge a membership fee
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Turn this off for a free community group. You can add a fee later.
          </p>
        </div>
        <Switch
          id="group-paid"
          checked={form.paid}
          onCheckedChange={(checked) => update("paid", checked)}
        />
      </div>

      {form.paid && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="group-fee">Membership fee (₱) *</Label>
            <Input
              id="group-fee"
              type="number"
              min={1}
              value={form.membership_fee_php}
              onChange={(e) => update("membership_fee_php", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="group-period">Membership length</Label>
            <Select
              value={
                PERIOD_PRESETS.some((p) => p.value === form.membership_period_days)
                  ? form.membership_period_days
                  : "custom"
              }
              onValueChange={(v) => {
                if (v !== "custom") update("membership_period_days", v);
              }}
            >
              <SelectTrigger id="group-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="mt-2"
              type="number"
              min={1}
              value={form.membership_period_days}
              onChange={(e) => update("membership_period_days", e.target.value)}
              aria-label="Membership length in days"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Members will see: <strong>{formatPhp(fee)}</strong> for {days} days.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="group-max">Member limit</Label>
          <Input
            id="group-max"
            type="number"
            min={1}
            value={form.max_members}
            onChange={(e) => update("max_members", e.target.value)}
            placeholder="Leave blank for unlimited"
          />
        </div>
        <div>
          <Label htmlFor="group-policy">Who can join</Label>
          <Select
            value={form.join_policy}
            onValueChange={(v) => update("join_policy", v as typeof form.join_policy)}
          >
            <SelectTrigger id="group-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open — anyone can request to join</SelectItem>
              <SelectItem value="approval">Approval — you review each member</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>What members get</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {BENEFIT_SUGGESTIONS.map((benefit) => {
            const active = form.benefits.includes(benefit);
            return (
              <Badge
                key={benefit}
                variant={active ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggleBenefit(benefit)}
              >
                {benefit}
              </Badge>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Tap the perks that apply — these show on your group page.
        </p>
      </div>
    </div>
  );
}
