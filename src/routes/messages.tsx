import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — BarangayHub" }] }),
  component: Inbox,
});

function Inbox() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [convs, setConvs] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("conversations")
      .select("*, businesses(name, slug)")
      .or(`consumer_id.eq.${user.id},owner_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false })
      .then(({ data }) => setConvs(data ?? []));
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-bold">Messages</h1>
        <div className="mt-6 space-y-2">
          {convs.length === 0 && <p className="text-muted-foreground">No messages yet.</p>}
          {convs.map((c) => (
            <Link key={c.id} to="/messages/$conversationId" params={{ conversationId: c.id }}>
              <Card className="p-4 transition-all hover:shadow-elegant">
                <div className="font-medium">{c.businesses?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.last_message_at).toLocaleString()}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
