import { supabase } from "@/integrations/supabase/client";
export const CONSENT_VERSION = "family-consent-v1.0";
export const FAMILY_PERMISSIONS = [
  ["public_profile", "Public Barangay Buddy profile"],
  ["spotlight_participation", "Spotlight audition participation"],
  ["public_media", "Public image and video display"],
  ["leaderboard", "Public voting and leaderboard inclusion"],
  ["booking_inquiries", "Receiving booking inquiries"],
  ["transportation", "Transportation coordination"],
  ["live_events", "Participation in live events"],
] as const;
export type Permission = (typeof FAMILY_PERMISSIONS)[number][0];
export type ChildProfile = {
  id: string;
  family_group_id: string;
  legal_name: string;
  display_name: string;
  birth_date: string;
  barangay_code: string;
  private_photo_path: string | null;
};
export type GuardianRelationship = {
  id: string;
  child_member_id: string;
  guardian_account_id: string;
  relationship: string;
  is_primary: boolean;
  status: "pending" | "verified" | "revoked";
};
export type MinorConsent = {
  id: string;
  child_profile_id: string;
  permission_type: Permission;
  guardian_account_id: string;
  revoked_at: string | null;
};
export type MinorBooking = {
  id: string;
  minor_child_profile_id: string | null;
  event_type: string;
  event_date: string;
  event_location: string;
  transport_needed: boolean;
  guardian_approved_at: string | null;
  status: string;
};
export async function loadFamily(userId: string) {
  const [
    { data: children, error },
    { data: relationships },
    { data: consents },
    { data: offers },
    { data: bookings },
  ] = await Promise.all([
    supabase.from("family_members").select("*").eq("kind", "child").order("created_at"),
    supabase.from("guardian_child_relationships").select("*").order("created_at"),
    supabase.from("minor_consents").select("*").is("revoked_at", null),
    supabase.from("family_rate_offers").select("*").order("base_price_php"),
    supabase
      .from("spotlight_booking_requests")
      .select(
        "id,minor_child_profile_id,event_type,event_date,event_location,transport_needed,guardian_approved_at,status",
      )
      .is("guardian_approved_at", null),
  ]);
  if (error) throw error;
  return {
    children: (children ?? []) as ChildProfile[],
    relationships: (relationships ?? []) as GuardianRelationship[],
    consents: (consents ?? []) as MinorConsent[],
    offers: offers ?? [],
    bookings: (bookings ?? []) as MinorBooking[],
    userId,
  };
}
