import { supabase } from "@/integrations/supabase/client";

const BUCKET = "jeepney-media";

/** Upload a landmark / stop photo and return the stored path. */
export async function uploadJeepneyPhoto(file: File, userId: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Signed URL for a stored jeepney photo path (bucket is private). */
export async function jeepneyPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

/** Resolve many photo paths at once into a path -> url map. */
export async function jeepneyPhotoUrls(
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  const entries = await Promise.all(
    unique.map(async (p) => [p, await jeepneyPhotoUrl(p)] as const),
  );
  const map: Record<string, string> = {};
  entries.forEach(([p, url]) => {
    if (url) map[p] = url;
  });
  return map;
}
