import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function SpotlightLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="border-b bg-primary text-primary-foreground">
        <nav className="container mx-auto flex gap-1 overflow-x-auto px-4 py-2 text-sm">
          <Link
            to="/spotlight"
            className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 font-semibold hover:bg-white/10"
          >
            <Sparkles className="h-4 w-4" /> Spotlight
          </Link>
          <Link
            to="/spotlight/star-of-the-month"
            className="shrink-0 rounded-lg px-3 py-2 hover:bg-white/10"
          >
            Star of the Month
          </Link>
          <Link
            to="/spotlight/leaderboard"
            className="shrink-0 rounded-lg px-3 py-2 hover:bg-white/10"
          >
            Leaderboard
          </Link>
          <Link
            to="/spotlight/sponsors"
            className="shrink-0 rounded-lg px-3 py-2 hover:bg-white/10"
          >
            Sponsors
          </Link>
        </nav>
      </div>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SpotlightHero({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden bg-gradient-hero text-white">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-amber-300">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl font-display text-4xl font-extrabold md:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base text-white/80 md:text-lg">{copy}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
