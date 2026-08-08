import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users2, Sparkles } from "lucide-react";
import { listPublicGroups, formatPhp, type GroupRow } from "@/lib/groups";

export const Route = createFileRoute("/groups/")({
  head: () => ({
    meta: [
      { title: "Clubs & Leagues — BarangayHub" },
      {
        name: "description",
        content:
          "Join sports leagues, hobby clubs, and interest groups across the Philippines. Members get free event entry and exclusive discounts at league venues.",
      },
      { property: "og:title", content: "Clubs & Leagues — BarangayHub" },
      {
        property: "og:description",
        content:
          "Local leagues and clubs across the Philippines — membership perks, member discounts, and events at partner venues.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsIndex,
});

function GroupsIndex() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPublicGroups()
      .then((rows) => setGroups(rows))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container mx-auto flex-1 px-4 py-10">
        <div className="mb-8 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            <Sparkles className="h-3.5 w-3.5" /> New
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">
            Clubs, Leagues & Groups
          </h1>
          <p className="mt-2 text-muted-foreground">
            Join local leagues and interest groups. Members get free entry to events and
            automatic discounts at partner venues nationwide.
          </p>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading groups…</div>
        ) : groups.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No public groups yet. Check back soon.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                to="/groups/$slug"
                params={{ slug: g.slug }}
                className="group block"
              >
                <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative h-40 bg-gradient-sun">
                    {g.cover_image_url ? (
                      <img
                        src={g.cover_image_url}
                        alt={g.name}
                        className="h-full w-full object-cover"
                      />
                    ) : g.slug === BILLIARDS_SLUG ? (
                      <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,oklch(0.32_0.07_155),oklch(0.18_0.04_160))]">
                        <img
                          src={billiardsLogo.url}
                          alt="Barangay Buddy Billiards League logo"
                          className="h-full w-auto object-contain py-2"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Trophy className="h-14 w-14 text-white/80" />
                      </div>
                    )}

                    <div className="absolute left-3 top-3">
                      <Badge className="bg-black/60 capitalize backdrop-blur">
                        {g.type.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-5">
                    <h2 className="font-display text-lg font-bold group-hover:text-primary">
                      {g.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {g.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Users2 className="h-4 w-4" />
                        {g.membership_period_days === 365 ? "Yearly" : `${g.membership_period_days}d`}
                      </span>
                      <span className="font-semibold text-foreground">
                        {g.membership_fee_php > 0
                          ? `${formatPhp(g.membership_fee_php)}/yr`
                          : "Free to join"}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
