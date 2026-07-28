import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Menu,
  Search,
  Fuel,
  LayoutDashboard,
  MessageSquare,
  LogOut,
  Home,
  Store,
  Plus,
  ExternalLink,
  Bell,
  Trophy,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type OwnedBusiness = {
  id: string;
  name: string;
  slug: string;
};

export function SiteHeader() {
  const { user, isOwner, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [ownedBusinesses, setOwnedBusinesses] = useState<OwnedBusiness[]>([]);

  useEffect(() => {
    if (!user) {
      setOwnedBusinesses([]);
      return;
    }

    supabase
      .from("businesses")
      .select("id, name, slug")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2)
      .then(({ data }) => setOwnedBusinesses((data ?? []) as OwnedBusiness[]));
  }, [user]);

  const hasBusiness = ownedBusinesses.length > 0;
  const firstBusiness = ownedBusinesses[0];

  const openBusinessAction = () => {
    if (!hasBusiness) {
      navigate({ to: "/add-business" });
      return;
    }

    if (ownedBusinesses.length === 1 && firstBusiness) {
      navigate({ to: "/dashboard/business/$id", params: { id: firstBusiness.id } });
      return;
    }

    navigate({ to: "/dashboard" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-sun shadow-sun">
            <MapPin className="h-5 w-5 text-sun-foreground" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-tight">BarangayHub</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              PH Network
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            to="/regions"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Browse
          </Link>
          <Link
            to="/barangays"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Home className="h-4 w-4" /> Barangays
          </Link>
          <Link
            to="/search"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" /> Search
          </Link>
          <Link
            to="/fuel"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Fuel className="h-4 w-4" /> Fuel Buddy
          </Link>
          <Link
            to="/groups"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Trophy className="h-4 w-4" /> Leagues
          </Link>
          <Link
            to="/spotlight"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" /> Spotlight
          </Link>
          <Link
            to="/family"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <UsersRound className="h-4 w-4" /> Family
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Menu className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.email?.split("@")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {isOwner && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={openBusinessAction}>
                  {hasBusiness ? (
                    <Store className="mr-2 h-4 w-4" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {hasBusiness
                      ? `My business${ownedBusinesses.length === 1 && firstBusiness?.name ? `: ${firstBusiness.name}` : ""}`
                      : "+ Add Business"}
                  </span>
                </DropdownMenuItem>
                {firstBusiness && (
                  <DropdownMenuItem
                    onClick={() => {
                      window.location.href = `/${firstBusiness.slug}`;
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> View public mini-site
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate({ to: "/messages" })}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Messages
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/spotlight/submit" })}>
                  <Sparkles className="mr-2 h-4 w-4" /> Audition for Spotlight
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/family" })}>
                  <UsersRound className="mr-2 h-4 w-4" /> Family account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/roadsafe-notifications" })}>
                  <Bell className="mr-2 h-4 w-4" /> Safety alerts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button
                size="sm"
                className="bg-foreground text-background hover:bg-foreground/90"
                asChild
              >
                <Link to="/signup">Join free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
