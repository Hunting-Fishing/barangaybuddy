import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Store, User } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — BarangayHub" },
      {
        name: "description",
        content: "Join BarangayHub free — list your business or discover your barangay.",
      },
    ],
  }),
  component: SignupPage,
});

const schema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
});

function SignupPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<"consumer" | "owner">("consumer");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) nav({ to: "/" });
  }, [user, nav]);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: parsed.data.displayName, role },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — welcome to BarangayHub!");
    nav({ to: role === "owner" ? "/dashboard" : "/" });
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: { role } },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg p-8 shadow-elegant">
          <h1 className="font-display text-3xl font-bold">Join BarangayHub</h1>
          <p className="mt-1 text-sm text-muted-foreground">Free for everyone, forever.</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole("consumer")}
              className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                role === "consumer"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              <User className="h-5 w-5" />
              <span className="font-medium">I'm a consumer</span>
              <span className="text-xs text-muted-foreground">Discover, review, send messages</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("owner")}
              className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                role === "owner"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              <Store className="h-5 w-5" />
              <span className="font-medium">I have a business</span>
              <span className="text-xs text-muted-foreground">
                List products, services & prices
              </span>
            </button>
          </div>

          <Button variant="outline" className="mt-6 w-full" onClick={google} type="button">
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handle} className="space-y-4">
            <div>
              <Label htmlFor="dn">Display name</Label>
              <Input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="pw">Password (min 8 chars)</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
