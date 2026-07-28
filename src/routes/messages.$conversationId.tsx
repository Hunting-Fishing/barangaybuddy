import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Send } from "lucide-react";

export const Route = createFileRoute("/messages/$conversationId")({
  component: Thread,
});

function Thread() {
  const { conversationId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data ?? []));

    const ch = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((m) => [...m, payload.new]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !user) return;
    const text = body.trim().slice(0, 2000);
    setBody("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body: text });
    if (error) console.error(error);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
        <div className="flex-1 space-y-2 overflow-y-auto">
          {messages.map((m) => (
            <Card
              key={m.id}
              className={`max-w-[75%] p-3 ${m.sender_id === user?.id ? "ml-auto bg-primary text-primary-foreground" : ""}`}
            >
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              <div
                className={`mt-1 text-[10px] ${m.sender_id === user?.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}
              >
                {new Date(m.created_at).toLocaleTimeString()}
              </div>
            </Card>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="mt-4 flex gap-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message…"
            maxLength={2000}
          />
          <Button type="submit">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}
