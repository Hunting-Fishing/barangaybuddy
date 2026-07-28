import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BusinessImportDialog } from "@/components/business-import-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import a business from Google or Facebook — BarangayHub" },
      {
        name: "description",
        content:
          "Paste a Google Maps or Facebook Page link and BarangayHub will fill in the business details with AI.",
      },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl font-bold">Add a business in 10 seconds</h1>
        <p className="mt-3 text-muted-foreground">
          Paste one or more links — Google Maps, Facebook, Instagram, X/Twitter, TikTok, LinkedIn,
          YouTube, or any website. Our AI reads every page and merges them into one listing — name,
          location, what they sell, features, hours. Review, tweak, publish. The catalog of tags and
          categories grows with every import.
        </p>
        <div className="mt-8">
          <BusinessImportDialog
            trigger={
              <Button size="lg" className="gap-2">
                <Sparkles className="h-5 w-5" /> Import from a link
              </Button>
            }
          />
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="Paste links">
            Google, Facebook, Instagram, X, TikTok, LinkedIn, YouTube, or any site — up to 6 at
            once.
          </Step>
          <Step n="2" title="AI extracts">
            Name, type, products, features, contact details — merged and prefilled.
          </Step>
          <Step n="3" title="Publish">
            As unclaimed for anyone, or as yours if you sign in.
          </Step>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs font-bold text-primary">STEP {n}</div>
      <div className="mt-1 font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
