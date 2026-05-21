// Server-only helpers for the business-import flow.
// Never import this from client code (filename ends with .server).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { FEATURE_TAG_GROUPS } from "@/lib/business-tags";

const GMAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FIRECRAWL_API = "https://api.firecrawl.dev/v2";

export type Source =
  | "google"
  | "facebook"
  | "instagram"
  | "twitter"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "website";

function getHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export type ExtractedBusiness = {
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: string | null;
  type: string;
  additional_types: string[];
  custom_types: string[];
  tags: { slug: string; label: string }[];
  products: { name: string; price: number | null; unit: string | null }[];
  source_external_id: string | null;
  cover_image_url: string | null;
};

export function detectSource(url: string): Source | null {
  try {
    const u = new URL(url);
    const host = getHost(url);
    if (host.includes("google.") || host === "goo.gl" || host === "maps.app.goo.gl" || host === "share.google") return "google";
    if (host.includes("facebook.") || host === "fb.com" || host === "m.facebook.com" || host === "fb.me") return "facebook";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "twitter.com" || host === "x.com" || host === "mobile.twitter.com") return "twitter";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com") || host === "vm.tiktok.com") return "tiktok";
    if (host === "linkedin.com" || host.endsWith(".linkedin.com") || host === "lnkd.in") return "linkedin";
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
    // Fall back to generic website scrape for any other valid URL
    return "website";
  } catch {
    return null;
  }
}

// ───────── Generic Firecrawl scrape (used for FB / IG / X / TikTok / LinkedIn / YT / websites) ─────────

export async function fetchScrape(url: string): Promise<{ markdown: string; raw: unknown }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("Firecrawl connector is not linked");

  // Facebook login-walls aggressively on www/m. Use mbasic.facebook.com (no JS, no login wall for public pages).
  const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  const isFacebook = /(^|\.)facebook\.com$|^fb\.(com|me)$/i.test(host);
  const candidates = isFacebook
    ? [
        url.replace(/:\/\/(www\.|m\.|web\.)?facebook\.com/i, "://mbasic.facebook.com"),
        url.replace(/:\/\/(www\.|mbasic\.|web\.)?facebook\.com/i, "://m.facebook.com"),
        url,
      ]
    : [url];

  let lastErr = "";
  for (const target of candidates) {
    try {
      const res = await fetch(`${FIRECRAWL_API}/scrape`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: target,
          formats: ["markdown"],
          onlyMainContent: !isFacebook,
          waitFor: isFacebook ? 3000 : 1500,
        }),
      });
      if (!res.ok) {
        lastErr = `Firecrawl error [${res.status}] for ${target}: ${await res.text()}`;
        continue;
      }
      const json = (await res.json()) as {
        data?: { markdown?: string; metadata?: unknown };
        markdown?: string;
        metadata?: unknown;
      };
      const md = json?.data?.markdown ?? json?.markdown ?? "";
      if (md && md.length >= 50) {
        return { markdown: md, raw: json?.data ?? json };
      }
      lastErr = `The page at ${target} returned no readable content (possibly private or login-walled)`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr || `Could not read ${url}`);
}

// ───────── Google Places fetcher ─────────

async function followShortUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.url || url;
  } catch {
    return url;
  }
}

function extractPlaceQuery(url: string): { textQuery?: string; placeId?: string } {
  try {
    const u = new URL(url);
    // place_id query param
    const pid = u.searchParams.get("place_id") || u.searchParams.get("cid");
    if (pid) return { placeId: pid };
    // /place/{name}/@lat,lng or /place/{name}
    const m = u.pathname.match(/\/place\/([^/@]+)/);
    if (m) return { textQuery: decodeURIComponent(m[1].replace(/\+/g, " ")) };
    // /maps/dir/{origin}/{destination}
    const dir = u.pathname.match(/\/maps\/dir\/[^/]*\/([^/@?]+)/);
    if (dir) return { textQuery: decodeURIComponent(dir[1].replace(/\+/g, " ")) };
    // Directions URLs: daddr / destination
    const dest = u.searchParams.get("daddr") || u.searchParams.get("destination");
    if (dest) return { textQuery: dest };
    // search?q=...
    const q = u.searchParams.get("q") || u.searchParams.get("query");
    if (q) return { textQuery: q };
    // Plus Code in the URL anywhere (e.g. "5Q4J+X5W Brgy, Piddig, Ilocos Norte")
    const plus = decodeURIComponent(url).match(/[2-9C-HJ-XR][2-9C-HJ-XR]{1,7}\+[2-9C-HJ-XR]{2,3}(?:[^&#]*)?/);
    if (plus) return { textQuery: plus[0].trim() };
    return { textQuery: url.slice(0, 200) };
  } catch {
    return { textQuery: url.slice(0, 200) };
  }
}

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryType?: string;
  types?: string[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text?: string };
  reviews?: { text?: { text?: string } }[];
  photos?: { name?: string }[];
};

async function gmaps(path: string, init?: RequestInit & { mask?: string }) {
  const key = process.env.LOVABLE_API_KEY;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  if (!apiKey) throw new Error("Google Maps connector is not linked");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "X-Connection-Api-Key": apiKey,
    "Content-Type": "application/json",
  };
  if (init?.mask) headers["X-Goog-FieldMask"] = init.mask;
  const res = await fetch(`${GMAPS_GATEWAY}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`Google Maps gateway error [${res.status}]: ${await res.text()}`);
  return res.json();
}

const PLACE_FIELDS =
  "id,displayName,formattedAddress,location,internationalPhoneNumber,nationalPhoneNumber,websiteUri,primaryType,types,regularOpeningHours,editorialSummary,reviews,photos";

export async function fetchGoogle(url: string): Promise<{ place: GooglePlace; rawText: string }> {
  const expanded = await followShortUrl(url);
  const q = extractPlaceQuery(expanded);

  let place: GooglePlace | null = null;
  if (q.placeId) {
    place = (await gmaps(`/places/v1/places/${encodeURIComponent(q.placeId)}`, {
      method: "GET",
      mask: PLACE_FIELDS,
    })) as GooglePlace;
  } else {
    const search = await gmaps(`/places/v1/places:searchText`, {
      method: "POST",
      body: JSON.stringify({ textQuery: q.textQuery, pageSize: 1 }),
      mask: `places.${PLACE_FIELDS.replace(/,/g, ",places.")}`,
    });
    place = (search?.places?.[0] ?? null) as GooglePlace | null;
  }
  if (!place) throw new Error("Google place not found for this URL");
  const rawText = [
    place.displayName?.text,
    place.formattedAddress,
    place.editorialSummary?.text,
    ...(place.regularOpeningHours?.weekdayDescriptions ?? []),
    ...(place.reviews ?? []).slice(0, 5).map((r) => r.text?.text ?? ""),
  ]
    .filter(Boolean)
    .join("\n");
  return { place, rawText };
}

// ───────── Facebook scrape via Firecrawl ─────────

export async function fetchFacebook(url: string): Promise<{ markdown: string; raw: unknown }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("Firecrawl connector is not linked");
  const res = await fetch(`${FIRECRAWL_API}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 1500,
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl error [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { data?: { markdown?: string; metadata?: unknown } };
  const md = json?.data?.markdown ?? "";
  if (!md || md.length < 50) throw new Error("Facebook page returned no readable content");
  return { markdown: md, raw: json?.data ?? json };
}

// ───────── Gemini extraction ─────────

const KNOWN_TAGS = FEATURE_TAG_GROUPS.flatMap((g) => g.tags.map((t) => t.slug));

function extractionSystem() {
  return [
    "You normalize a Philippine business listing scraped from Google or Facebook into a strict JSON schema.",
    "Rules:",
    "- Never invent contact details, addresses, or coordinates that are not in the source.",
    "- If a field is missing or unclear, return null (or [] for arrays).",
    "- 'type' MUST be one of: " + BUSINESS_TYPES.join(", ") + ".",
    "- 'additional_types' MUST be a subset of the same list (no duplicates of 'type').",
    "- 'custom_types' is for things outside that list (e.g. 'bar', 'pub', 'billiard hall', 'kakanin').",
    "- 'tags' are short feature slugs (kebab-case, e.g. 'billiards', 'free-wifi'). Prefer reusing these known slugs when they apply: " +
      KNOWN_TAGS.slice(0, 80).join(", ") +
      ". You MAY invent new ones if the source clearly mentions a feature with no good match — keep them short, kebab-case, English, ≤ 30 chars.",
    "- Each tag has a human label too. For known slugs use a natural label.",
    "- 'products' is optional: a few clearly-mentioned items only.",
  ].join("\n");
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "description",
    "address",
    "latitude",
    "longitude",
    "phone",
    "email",
    "website",
    "hours",
    "type",
    "additional_types",
    "custom_types",
    "tags",
    "products",
  ],
  properties: {
    name: { type: "string" },
    description: { type: ["string", "null"] },
    address: { type: ["string", "null"] },
    latitude: { type: ["number", "null"] },
    longitude: { type: ["number", "null"] },
    phone: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    website: { type: ["string", "null"] },
    hours: { type: ["string", "null"] },
    type: { type: "string", enum: BUSINESS_TYPES as unknown as string[] },
    additional_types: { type: "array", items: { type: "string", enum: BUSINESS_TYPES as unknown as string[] }, maxItems: 8 },
    custom_types: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 8 },
    tags: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "label"],
        properties: { slug: { type: "string", maxLength: 40 }, label: { type: "string", maxLength: 60 } },
      },
    },
    products: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "price", "unit"],
        properties: {
          name: { type: "string", maxLength: 120 },
          price: { type: ["number", "null"] },
          unit: { type: ["string", "null"], maxLength: 20 },
        },
      },
    },
  },
} as const;

export async function geminiExtract(args: {
  source: Source;
  url: string;
  hint?: string;
  payload: unknown;
  textHint?: string;
}): Promise<ExtractedBusiness> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const userParts = [
    `Source: ${args.source}`,
    `URL: ${args.url}`,
    args.hint ? `Operator hint: ${args.hint}` : "",
    args.textHint ? `Key snippets:\n${args.textHint.slice(0, 2000)}` : "",
    `Raw payload (truncated):\n${JSON.stringify(args.payload).slice(0, 8000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: extractionSystem() },
        { role: "user", content: userParts },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "extracted_business", strict: true, schema: SCHEMA },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI is rate limited right now — please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    throw new Error(`AI gateway error [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: ExtractedBusiness;
  try {
    parsed = JSON.parse(content) as ExtractedBusiness;
  } catch {
    throw new Error("AI returned an invalid response, please try again.");
  }

  // Attach source_external_id and cover image when we can derive them
  let source_external_id: string | null = null;
  let cover_image_url: string | null = null;
  if (args.source === "google") {
    const p = (args.payload ?? {}) as GooglePlace;
    source_external_id = p.id ?? null;
    if (p.photos?.[0]?.name && process.env.GOOGLE_MAPS_API_KEY) {
      // Reference for the photo (frontend will use the URL as-is)
      cover_image_url = `${GMAPS_GATEWAY}/places/v1/${encodeURI(p.photos[0].name!)}/media?maxHeightPx=720`;
    }
  }
  return { ...parsed, source_external_id, cover_image_url };
}

// ───────── Catalog growth + canonical slugging ─────────

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function persistCatalogGrowth(extracted: ExtractedBusiness): Promise<{ tags: string[]; customTypes: string[] }> {
  // tags
  const tagRows = extracted.tags
    .map((t) => ({ slug: toSlug(t.slug || t.label), label: t.label.trim().slice(0, 60) }))
    .filter((t) => t.slug.length >= 2);
  const uniqTagRows = Array.from(new Map(tagRows.map((t) => [t.slug, t])).values());
  if (uniqTagRows.length > 0) {
    await supabaseAdmin
      .from("tag_catalog")
      .upsert(
        uniqTagRows.map((t) => ({ slug: t.slug, label: t.label, usage_count: 1, source: "gemini" })),
        { onConflict: "slug", ignoreDuplicates: true },
      );
  }


  // custom types
  const customRows = extracted.custom_types
    .map((label) => ({ slug: toSlug(label), label: label.trim().slice(0, 40) }))
    .filter((t) => t.slug.length >= 2);
  const uniqCustomRows = Array.from(new Map(customRows.map((t) => [t.slug, t])).values());
  if (uniqCustomRows.length > 0) {
    await supabaseAdmin
      .from("custom_type_catalog")
      .upsert(
        uniqCustomRows.map((t) => ({ slug: t.slug, label: t.label, usage_count: 1, source: "gemini" })),
        { onConflict: "slug", ignoreDuplicates: true },
      );
  }

  return { tags: uniqTagRows.map((t) => t.slug), customTypes: uniqCustomRows.map((t) => t.label) };
}

// ───────── Barangay resolver (loose name match against admin area from Google) ─────────

export async function resolveBarangay(args: {
  address: string | null;
  lat: number | null;
  lng: number | null;
}): Promise<string | null> {
  if (!args.address) return null;
  const parts = args.address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // Try each part as a barangay name (most addresses put barangay early)
  for (const p of parts.slice(0, 3)) {
    const clean = p.replace(/^(brgy\.?|barangay)\s+/i, "").trim();
    if (clean.length < 2) continue;
    const { data } = await supabaseAdmin
      .from("barangays")
      .select("code")
      .ilike("name", clean)
      .limit(1);
    if (data && data.length > 0) return data[0].code as string;
  }
  return null;
}

// ───────── Slug builder for businesses ─────────

export function buildBusinessSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "business"}-${Math.random().toString(36).slice(2, 7)}`;
}
