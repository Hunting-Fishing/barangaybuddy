// Server-only shared helpers: pull Philippine fuel price information from public
// news/advisory sources via Firecrawl web search, then structure it with Lovable AI.
// DOE's own site is behind Cloudflare and blocks automated access, so we rely on
// the weekly oil price advisories that DOE and oil firms publish to the press.

export type SearchHit = { url: string; title: string; text: string };

export async function firecrawlSearch(
  query: string,
  opts: { limit?: number; tbs?: string } = {},
): Promise<SearchHit[]> {
  const apiKey = process.env["FIRECRAWL_API_KEY"];
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: opts.limit ?? 5,
      tbs: opts.tbs ?? "qdr:w",
      country: "ph",
      lang: "en",
      scrapeOptions: { formats: ["markdown"] },
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl search ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = (await res.json()) as any;
  const raw = json.data ?? json.results ?? [];
  const list: any[] = Array.isArray(raw) ? raw : (raw.web ?? raw.news ?? []);

  return list
    .map((r) => ({
      url: String(r.url ?? ""),
      title: String(r.title ?? ""),
      text: String(r.markdown ?? r.description ?? "").slice(0, 6000),
    }))
    .filter((r) => r.url && r.text.length > 40);
}

export async function aiExtractJson<T>(system: string, user: string): Promise<T | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = (await res.json()) as any;
  const content: string = json.choices?.[0]?.message?.content ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export function sourceName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}
