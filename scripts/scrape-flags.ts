/* eslint-disable no-console */
/**
 * One-time scraper: resolves an official flag / seal image for every region,
 * province and city/municipality in the database, uploads each PNG to the
 * `locality-flags` Supabase Storage bucket and records the public URL in the
 * corresponding row's `flag_url` column.
 *
 * Run with:   bun scripts/scrape-flags.ts            (resumes; only fills empty)
 *             bun scripts/scrape-flags.ts --level=regions
 *             bun scripts/scrape-flags.ts --force    (refetch even if filled)
 *             bun scripts/scrape-flags.ts --limit=50 (cap rows; useful for tests)
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const LEVEL = [...args].find((a) => a.startsWith("--level="))?.split("=")[1];
const LIMIT_ARG = [...args].find((a) => a.startsWith("--limit="))?.split("=")[1];
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG) : Infinity;

const UA = "BarangayHub-FlagScraper/1.0 (https://barangayhub.lovable.app; contact@barangayhub.local)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const ENWIKI_API = "https://en.wikipedia.org/w/api.php";

// ----- small helpers -----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function rateLimitedFetch(url: string, init?: RequestInit, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, "Api-User-Agent": UA, ...(init?.headers ?? {}) },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const wait = 500 * (attempt + 1) ** 2;
    await sleep(wait);
    return rateLimitedFetch(url, init, attempt + 1);
  }
  return res;
}

type Level = "regions" | "provinces" | "cities";

type Row = { code: string; slug: string; name: string; flag_url: string | null };

// Build the list of candidate Wikipedia article titles to try, ranked by
// likelihood. First match with an infobox image wins.
function candidateTitles(level: Level, name: string): string[] {
  const trimmed = name.trim();
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  const inParen = parenMatch?.[1]?.trim();
  const noParen = trimmed.replace(/\s*\(.*?\)\s*/g, "").trim();
  const candidates: string[] = [];
  if (level === "regions") {
    // For PH regions the Wikipedia article title is usually the friendly
    // name (e.g. "Bicol Region", "Cordillera Administrative Region"), which
    // is what we stored inside the parens.
    if (inParen) candidates.push(inParen);
    candidates.push(trimmed, noParen, `${noParen} (Philippines)`);
  } else if (level === "provinces") {
    candidates.push(trimmed, `${trimmed} (province)`, `Province of ${noParen}`, `${noParen}, Philippines`);
    if (inParen) candidates.push(inParen);
  } else {
    candidates.push(
      trimmed,
      `${noParen}, Philippines`,
      `${noParen} (city)`,
      `${noParen} (municipality)`,
    );
    if (inParen) candidates.push(inParen);
  }
  return [...new Set(candidates)].filter(Boolean);
}

// Search the page's images for a likely flag/seal file.
async function findInfoboxImageOnPage(title: string): Promise<string | null> {
  // Step 1: get all image filenames on the page
  const imagesUrl =
    `${ENWIKI_API}?action=query&format=json&prop=images&imlimit=50&titles=${encodeURIComponent(title)}&origin=*`;
  const res = await rateLimitedFetch(imagesUrl);
  if (!res.ok) return null;
  const json: any = await res.json();
  const pages = json?.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  if (!page || page.missing) return null;
  const imgs: string[] = (page.images ?? []).map((i: any) => i.title);
  if (!imgs.length) return null;

  // Heuristic ranking: prefer files mentioning the locality + flag/seal/coat
  const lower = title.toLowerCase();
  const score = (f: string) => {
    const n = f.toLowerCase();
    let s = 0;
    if (n.includes("flag")) s += 10;
    if (n.includes("seal")) s += 8;
    if (n.includes("coat_of_arms") || n.includes("coat of arms")) s += 6;
    if (lower.split(/\s+/).some((tok) => tok.length > 3 && n.includes(tok.toLowerCase()))) s += 4;
    if (n.includes("ph") || n.includes("philippines")) s += 1;
    if (n.endsWith(".svg") || n.endsWith(".png")) s += 1;
    if (n.includes("location") || n.includes("map")) s -= 20;
    if (n.includes("icon") || n.includes("logo of")) s -= 5;
    return s;
  };
  const ranked = imgs
    .map((f) => ({ f, s: score(f) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.f ?? null;
}

// Resolve a File:Whatever.svg to an actual raster URL via Commons imageinfo.
async function fileToRasterUrl(fileTitle: string): Promise<string | null> {
  const url =
    `${COMMONS_API}?action=query&format=json&prop=imageinfo&iiprop=url|mime&iiurlwidth=512&titles=${encodeURIComponent(fileTitle)}&origin=*`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) return null;
  const json: any = await res.json();
  const pages = json?.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  // thumburl scales SVGs to PNG for us; fall back to url for raster originals
  return info.thumburl ?? info.url ?? null;
}

async function resolveFlag(level: Level, name: string): Promise<{ url: string; via: string } | null> {
  for (const title of candidateTitles(level, name)) {
    const file = await findInfoboxImageOnPage(title);
    if (!file) continue;
    const url = await fileToRasterUrl(file);
    if (url) return { url, via: `${title} → ${file}` };
  }
  return null;
}

async function downloadAndNormalize(url: string): Promise<Buffer> {
  const res = await rateLimitedFetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const ab = await res.arrayBuffer();
  // Normalise to PNG ≤ 256px wide, transparent background preserved.
  return sharp(Buffer.from(ab))
    .resize({ width: 256, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function uploadFlag(folder: Level, slug: string, buf: Buffer): Promise<string> {
  const path = `${folder}/${slug}.png`;
  const { error } = await supabase.storage
    .from("locality-flags")
    .upload(path, buf, { contentType: "image/png", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("locality-flags").getPublicUrl(path);
  return data.publicUrl;
}

async function processLevel(level: Level, table: string) {
  console.log(`\n=== ${level.toUpperCase()} ===`);
  let q = supabase.from(table).select("code,slug,name,flag_url").order("name");
  if (!FORCE) q = q.is("flag_url", null);
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as Row[];
  if (rows.length > LIMIT) rows = rows.slice(0, LIMIT);
  console.log(`${rows.length} rows to process${FORCE ? " (force)" : ""}`);

  const misses: { level: Level; slug: string; name: string; reason: string }[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const found = await resolveFlag(level, row.name);
      if (!found) {
        misses.push({ level, slug: row.slug, name: row.name, reason: "no candidate image" });
        process.stdout.write(`  · [${i + 1}/${rows.length}] ${row.name} — miss\n`);
        continue;
      }
      const buf = await downloadAndNormalize(found.url);
      const publicUrl = await uploadFlag(level, row.slug, buf);
      const { error: upErr } = await supabase.from(table).update({ flag_url: publicUrl }).eq("code", row.code);
      if (upErr) throw upErr;
      ok++;
      process.stdout.write(`  ✓ [${i + 1}/${rows.length}] ${row.name}\n`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      misses.push({ level, slug: row.slug, name: row.name, reason: msg });
      process.stdout.write(`  ✗ [${i + 1}/${rows.length}] ${row.name} — ${msg}\n`);
    }
    // gentle pacing: ~5 req/s towards Wikimedia, well under their guidance
    await sleep(200);
  }
  console.log(`Result: ${ok}/${rows.length} flagged · ${misses.length} misses`);

  if (misses.length) {
    if (!existsSync("scripts")) await mkdir("scripts");
    const file = `scripts/flag-misses-${level}.json`;
    await writeFile(file, JSON.stringify(misses, null, 2));
    console.log(`Wrote ${file}`);
  }
}

async function main() {
  const targets: [Level, string][] = [
    ["regions", "regions"],
    ["provinces", "provinces"],
    ["cities", "cities_municipalities"],
  ];
  for (const [level, table] of targets) {
    if (LEVEL && LEVEL !== level) continue;
    await processLevel(level, table);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
