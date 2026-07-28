import { supabase } from "@/integrations/supabase/client";

export const TALENT_CATEGORIES = [
  "Singing",
  "Dancing",
  "Music",
  "Comedy",
  "Spoken word",
  "Variety",
] as const;
export const SPONSOR_TIERS = [
  {
    id: "community",
    name: "Community Supporter",
    copy: "Logo placement on campaign pages and community recognition.",
  },
  {
    id: "spotlight",
    name: "Spotlight Partner",
    copy: "Prominent campaign placement, profile-page visibility, and event mentions.",
  },
  {
    id: "title",
    name: "Title Partner",
    copy: "Top billing across the campaign, branded features, and priority activation support.",
  },
] as const;
export type PublicTalent = {
  id: string;
  campaign_id: string;
  slug: string;
  stage_name: string;
  category: string;
  biography: string;
  availability: string;
  audition_video_url: string;
  public_photo_url: string | null;
  status: "approved" | "featured";
  barangay_code: string;
  barangay_name: string;
  city_name: string;
  province_name: string;
  featured_at: string | null;
};
export type LeaderboardTalent = PublicTalent & { votes: number; judgeScore: number; score: number };
export type PeoplesChoiceTalent = Pick<
  PublicTalent,
  "slug" | "stage_name" | "public_photo_url" | "barangay_name" | "city_name"
> & { submission_id: string; votes: number };

export async function activeCampaign() {
  const { data, error } = await supabase
    .from("spotlight_campaigns")
    .select("*")
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function publicTalents() {
  const { data, error } = await supabase
    .from("spotlight_public_profiles")
    .select("*")
    .order("featured_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as PublicTalent[];
}
export async function talentBySlug(slug: string) {
  const { data, error } = await supabase
    .from("spotlight_public_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as PublicTalent | null;
}
export async function leaderboard(): Promise<LeaderboardTalent[]> {
  const { data, error } = await supabase
    .from("spotlight_leaderboard")
    .select("*")
    .order("combined_score", { ascending: false })
    .order("votes", { ascending: false })
    .order("stage_name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as PublicTalent),
    votes: row.votes ?? 0,
    judgeScore: Number(row.judge_score ?? 0),
    score: Number(row.combined_score ?? 0),
  }));
}
export async function peoplesChoice(): Promise<PeoplesChoiceTalent | null> {
  const { data, error } = await (supabase as any)
    .from("spotlight_peoples_choice")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as PeoplesChoiceTalent | null;
}
export function ageOn(date: string) {
  const born = new Date(`${date}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age--;
  return age;
}
export function makeSlug(name: string) {
  return `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`;
}
