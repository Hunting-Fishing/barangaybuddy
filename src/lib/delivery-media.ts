import { supabase } from "@/integrations/supabase/client";

const BUCKET = "business-media";

/** Upload a rider branding photo and return its public URL. */
export async function uploadDeliveryPhoto(
  file: File,
  userId: string,
  kind: "vehicle" | "uniform" | "proof",
): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `delivery/${userId}/${kind}-${Date.now()}-${Math.random()
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
