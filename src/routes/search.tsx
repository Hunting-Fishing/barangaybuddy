import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: (s.q as string) || "",
    type: (s.type as string) || "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, slug, type, description, cover_image_url, barangays(name)")
        .ilike("name", `%${q}%`)
        .eq("is_published", true)
        .limit(50);
      setResults(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16">
        <h1 className="font-display text-4xl font-bold">Search</h1>
        <div className="relative mt-6 max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search businesses…" className="h-14 pl-12 text-base" />
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((b) => (
            <Link key={b.id} to="/business/$slug" params={{ slug: b.slug }}>
              <Card className="overflow-hidden p-5 transition-all hover:-translate-y-1 hover:shadow-elegant">
                <div className="text-xs uppercase text-muted-foreground">{b.type.replace("_", " ")}</div>
                <h3 className="mt-1 font-display text-lg font-bold">{b.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
              </Card>
            </Link>
          ))}
          {q && results.length === 0 && <p className="text-muted-foreground">No matches.</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
