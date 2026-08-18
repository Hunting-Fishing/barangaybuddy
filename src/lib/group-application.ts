// Shared model + validation for the "Add your club or league" application form.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type GroupPaymentMethod =
  | { kind: "gcash"; number: string; account_name: string; qr_url?: string | null }
  | { kind: "maya"; number: string; account_name: string; qr_url?: string | null }
  | {
      kind: "bank";
      bank_name: string;
      account_name: string;
      account_number: string;
      qr_url?: string | null;
    }
  | { kind: "cash"; account_name: string }
  | { kind: "other"; label: string; details: string };

export const PAYMENT_METHOD_LABEL: Record<GroupPaymentMethod["kind"], string> = {
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank transfer",
  cash: "Cash in person",
  other: "Other",
};

export type GroupApplicationForm = {
  name: string;
  type: "league" | "club" | "interest_group";
  tagline: string;
  description: string;
  city: string;
  barangay: string;
  logo_url: string | null;
  cover_image_url: string | null;
  paid: boolean;
  membership_fee_php: string;
  membership_period_days: string;
  benefits: string[];
  max_members: string;
  join_policy: "open" | "approval";
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_url: string;
  payment_methods: GroupPaymentMethod[];
  payment_notes: string;
};

export const EMPTY_GROUP_APPLICATION: GroupApplicationForm = {
  name: "",
  type: "club",
  tagline: "",
  description: "",
  city: "",
  barangay: "",
  logo_url: null,
  cover_image_url: null,
  paid: false,
  membership_fee_php: "100",
  membership_period_days: "365",
  benefits: [],
  max_members: "",
  join_policy: "open",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  contact_url: "",
  payment_methods: [],
  payment_notes: "",
};

export const PERIOD_PRESETS = [
  { value: "30", label: "Monthly (30 days)" },
  { value: "90", label: "Quarterly (90 days)" },
  { value: "180", label: "Half year (180 days)" },
  { value: "365", label: "Yearly (365 days)" },
];

const phoneRe = /^(\+?63|0)9\d{9}$/;

export function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "");
}

export function validateStep(step: 1 | 2 | 3, form: GroupApplicationForm): string | null {
  if (step === 1) {
    if (form.name.trim().length < 3) return "Enter your group name (at least 3 characters).";
    if (form.name.trim().length > 80) return "Group name is too long (max 80 characters).";
    if (form.description.trim().length < 20)
      return "Add a short description so members know what you do (at least 20 characters).";
    if (form.description.length > 2000) return "Description is too long (max 2000 characters).";
    if (!form.city.trim()) return "Tell us which city or municipality you are based in.";
    return null;
  }
  if (step === 2) {
    if (form.paid) {
      const fee = Number(form.membership_fee_php);
      if (!Number.isFinite(fee) || fee <= 0) return "Enter a membership fee greater than ₱0.";
      if (fee > 100000) return "Membership fee cannot be more than ₱100,000.";
    }
    const days = Number(form.membership_period_days);
    if (!Number.isFinite(days) || days < 1) return "Membership length must be at least 1 day.";
    if (form.max_members.trim() && Number(form.max_members) < 1)
      return "Member limit must be at least 1, or leave it blank for unlimited.";
    return null;
  }
  if (!form.contact_name.trim()) return "Enter the name of the person we can contact.";
  const email = form.contact_email.trim();
  const phone = normalizePhone(form.contact_phone.trim());
  if (!email && !phone) return "Add a contact email or mobile number so we can reach you.";
  if (email && !z.string().email().safeParse(email).success)
    return "That email address doesn't look right.";
  if (phone && !phoneRe.test(phone))
    return "Mobile number should look like 09XX XXX XXXX or +639XX XXX XXXX.";
  if (form.contact_url.trim() && !/^https?:\/\//i.test(form.contact_url.trim()))
    return "Website / Facebook link must start with http:// or https://";
  if (form.paid && form.payment_methods.length === 0)
    return "Add at least one way for members to pay you.";
  for (const method of form.payment_methods) {
    if ((method.kind === "gcash" || method.kind === "maya") && !normalizePhone(method.number))
      return `Enter the ${PAYMENT_METHOD_LABEL[method.kind]} mobile number.`;
    if (method.kind === "bank" && (!method.bank_name.trim() || !method.account_number.trim()))
      return "Enter the bank name and account number.";
    if (method.kind === "other" && !method.details.trim())
      return "Describe how members should pay with your other method.";
  }
  return null;
}

/** Human readable fallback stored in the legacy free-text column. */
export function buildPaymentInstructions(form: GroupApplicationForm): string | null {
  const lines: string[] = [];
  for (const m of form.payment_methods) {
    if (m.kind === "gcash" || m.kind === "maya")
      lines.push(`${PAYMENT_METHOD_LABEL[m.kind]}: ${m.number}${m.account_name ? ` (${m.account_name})` : ""}`);
    else if (m.kind === "bank")
      lines.push(
        `Bank transfer: ${m.bank_name} — ${m.account_number}${m.account_name ? ` (${m.account_name})` : ""}`,
      );
    else if (m.kind === "cash")
      lines.push(`Cash in person${m.account_name ? ` — ask for ${m.account_name}` : ""}`);
    else lines.push(`${m.label || "Other"}: ${m.details}`);
  }
  if (form.payment_notes.trim()) lines.push(form.payment_notes.trim());
  return lines.length ? lines.join("\n") : null;
}

export function slugifyGroup(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const BUCKET = "business-media";

export async function uploadGroupImage(
  file: File,
  userId: string,
  kind: "logo" | "cover" | "qr",
): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `groups/${userId}/${kind}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Read payment methods off a group row, falling back to the legacy text field. */
export function readPaymentMethods(group: {
  payment_methods?: unknown;
  payment_instructions?: string | null;
}): GroupPaymentMethod[] {
  const raw = group.payment_methods;
  if (Array.isArray(raw)) return raw as GroupPaymentMethod[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as GroupPaymentMethod[];
    } catch {
      /* ignore */
    }
  }
  return [];
}
