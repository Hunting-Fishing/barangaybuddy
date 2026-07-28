import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, MapPin } from "lucide-react";
import { SpotlightLayout } from "@/components/spotlight-layout";
import { Card } from "@/components/ui/card";
import { leaderboard, type LeaderboardTalent } from "@/lib/spotlight";
export const Route = createFileRoute("/spotlight/leaderboard")({ component: Page });
function Page() {
  const [rows, setRows] = useState<LeaderboardTalent[]>([]),
    [page, setPage] = useState(1);
  useEffect(() => {
    leaderboard().then(setRows);
  }, []);
  const visible = rows.slice((page - 1) * 10, page * 10);
  return (
    <SpotlightLayout>
      <section className="container mx-auto px-4 py-12">
        <p className="text-sm font-bold uppercase tracking-wider text-primary">Star of the Month</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Leaderboard</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Live standings: 70% normalized community vote and 30% average judge score.
        </p>
        <div className="mt-8 space-y-3">
          {visible.map((r, i) => (
            <Link key={r.id} to="/spotlight/talent/$slug" params={{ slug: r.slug }}>
              <Card className="mb-3 grid grid-cols-[auto_1fr] items-center gap-4 p-4 sm:grid-cols-[auto_1fr_auto]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 font-display text-lg font-bold text-amber-800">
                  {(page - 1) * 10 + i + 1}
                </div>
                <div>
                  <h2 className="font-display font-bold">{r.stage_name}</h2>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {r.barangay_name} · {r.category}
                  </p>
                </div>
                <div className="col-span-2 flex gap-4 text-xs sm:col-span-1 sm:text-right">
                  <span>{r.votes} votes</span>
                  <span>{r.judgeScore.toFixed(1)} judge</span>
                  <strong>{r.score.toFixed(1)} pts</strong>
                </div>
              </Card>
            </Link>
          ))}
          {!rows.length && (
            <Card className="p-10 text-center text-muted-foreground">
              <Award className="mx-auto mb-3 h-10 w-10" />
              Standings will appear when approved talent enters the campaign.
            </Card>
          )}
        </div>
        {rows.length > 10 && (
          <div className="mt-6 flex justify-center gap-3">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button disabled={page * 10 >= rows.length} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </section>
    </SpotlightLayout>
  );
}
