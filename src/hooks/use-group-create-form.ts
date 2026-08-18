import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_GROUP_APPLICATION,
  buildPaymentInstructions,
  normalizePhone,
  slugifyGroup,
  validateStep,
  type GroupApplicationForm,
} from "@/lib/group-application";

const anyDb = supabase as any;

export function useGroupCreateForm(onSubmitted?: () => void) {
  const [form, setForm] = useState<GroupApplicationForm>(EMPTY_GROUP_APPLICATION);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  const update = useCallback(
    <K extends keyof GroupApplicationForm>(key: K, value: GroupApplicationForm[K]) =>
      setForm((current) => ({ ...current, [key]: value })),
    [],
  );

  const reset = useCallback(() => {
    setForm(EMPTY_GROUP_APPLICATION);
    setStep(1);
  }, []);

  const next = useCallback(() => {
    const error = validateStep(step, form);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  }, [form, step]);

  const back = useCallback(() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s)), []);

  const submit = useCallback(
    async (userId: string): Promise<boolean> => {
      for (const s of [1, 2, 3] as const) {
        const error = validateStep(s, form);
        if (error) {
          setStep(s);
          toast.error(error);
          return false;
        }
      }

      setSubmitting(true);
      const slug = `${slugifyGroup(form.name.trim())}-${Math.random().toString(36).slice(2, 6)}`;
      const legacyInstructions = buildPaymentInstructions(form);
      const base = {
        slug,
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || null,
        membership_fee_php: form.paid ? Math.max(0, Number(form.membership_fee_php) || 0) : 0,
        membership_period_days: Math.max(1, Number(form.membership_period_days) || 365),
        payment_instructions: legacyInstructions,
        logo_url: form.logo_url,
        cover_image_url: form.cover_image_url,
        is_public: false,
        created_by: userId,
      };
      const extended = {
        ...base,
        tagline: form.tagline.trim() || null,
        city_code: form.city.trim() || null,
        barangay_code: form.barangay.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_url: form.contact_url.trim() || null,
        max_members: form.max_members.trim() ? Number(form.max_members) : null,
        join_policy: form.join_policy,
        benefits: form.benefits,
        payment_methods: form.payment_methods,
      };

      let inserted: { id: string } | null = null;
      let { data, error } = await anyDb.from("groups").insert(extended).select("id").single();
      if (error) {
        // Fall back to the legacy column set if the richer columns aren't live yet.
        const retry = await anyDb.from("groups").insert(base).select("id").single();
        data = retry.data;
        error = retry.error;
      }
      inserted = (data as { id: string } | null) ?? null;

      if (error || !inserted) {
        setSubmitting(false);
        toast.error(error?.message ?? "Could not submit your group. Please try again.");
        return false;
      }

      const phone = normalizePhone(form.contact_phone.trim());
      if (phone) {
        await anyDb
          .from("group_contacts")
          .upsert({ group_id: inserted.id, contact_phone: phone }, { onConflict: "group_id" });
      }

      setSubmitting(false);
      reset();
      toast.success("Application sent! We review every group before it goes live on the directory.");
      onSubmitted?.();
      return true;
    },
    [form, onSubmitted, reset],
  );

  return { form, setForm, update, step, setStep, next, back, submitting, submit, reset };
}
