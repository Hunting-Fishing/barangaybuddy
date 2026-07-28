// Shared client helpers for the Groups & Leagues feature.
import { supabase } from "@/integrations/supabase/client";

export type GroupRow = {
  id: string;
  slug: string;
  name: string;
  type: "league" | "club" | "interest_group";
  description: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  membership_fee_php: number;
  membership_period_days: number;
  is_public: boolean;
  payment_instructions: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MembershipRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "active" | "expired" | "cancelled";
  started_at: string | null;
  expires_at: string | null;
  payment_ref: string | null;
  payment_note: string | null;
  amount_paid_php: number;
};

export type GroupVenueRow = {
  id: string;
  group_id: string;
  business_id: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string | null;
  approved_at: string | null;
};

export type GroupEventRow = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  venue_business_id: string | null;
  starts_at: string;
  ends_at: string | null;
  entry_fee_php: number;
  member_free: boolean;
  status: "scheduled" | "cancelled" | "completed";
  cover_image_url: string | null;
};

export type GroupPromoRow = {
  id: string;
  group_id: string;
  business_id: string | null;
  title: string;
  description: string | null;
  discount_percent: number | null;
  discount_amount_php: number | null;
  code: string | null;
  valid_from: string;
  valid_until: string | null;
};

const anyDb = supabase as any;

export async function listPublicGroups() {
  const { data, error } = await anyDb
    .from("groups")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GroupRow[];
}

export async function getGroupBySlug(slug: string) {
  const { data, error } = await anyDb.from("groups").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as GroupRow | null;
}

export async function getMyMembership(groupId: string, userId: string) {
  const { data } = await anyDb
    .from("group_memberships")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return data as MembershipRow | null;
}

export function isActiveMembership(m: MembershipRow | null | undefined) {
  if (!m) return false;
  if (m.status !== "active") return false;
  if (!m.expires_at) return true;
  return new Date(m.expires_at).getTime() > Date.now();
}

export function computeDiscount(
  price: number,
  promo: Pick<GroupPromoRow, "discount_percent" | "discount_amount_php">,
): { discounted: number; saved: number } {
  let discounted = price;
  if (promo.discount_percent) {
    discounted = price * (1 - Number(promo.discount_percent) / 100);
  } else if (promo.discount_amount_php) {
    discounted = Math.max(0, price - promo.discount_amount_php);
  }
  return { discounted: Math.round(discounted * 100) / 100, saved: Math.max(0, price - discounted) };
}

export function formatPhp(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}
