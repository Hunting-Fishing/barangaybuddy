import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password — BarangayHub" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const [email, setEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const isRecovery =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Reset link sent — check your email.");
  }

  async function updatePw(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) toast.error(error.message);
    else toast.success("Password updated. You're signed in.");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 shadow-elegant">
          <h1 className="font-display text-3xl font-bold">
            {isRecovery ? "Set new password" : "Reset password"}
          </h1>
          {isRecovery ? (
            <form onSubmit={updatePw} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="np">New password</Label>
                <Input
                  id="np"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full">
                Update password
              </Button>
            </form>
          ) : (
            <form onSubmit={sendReset} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="em">Email</Label>
                <Input
                  id="em"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Send reset link
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
