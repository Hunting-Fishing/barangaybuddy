import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Store } from "lucide-react";
import { AddBusinessForm } from "@/components/add-business-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/add-business")({
  head: () => ({
    meta: [
      { title: "Add a business — BarangayHub" },
      {
        name: "description",
        content:
          "Create a claimed BarangayHub business listing with categories, features, location, contact details, and photos.",
      },
    ],
  }),
  component: AddBusinessPage,
});

function AddBusinessPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Add business</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Store className="h-3.5 w-3.5" />
              Owner setup
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">
              Add your business
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Create a claimed listing that customers can find by barangay, category, features, and search.
            </p>
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking your account…</p>
          ) : user ? (
            <AddBusinessForm />
          ) : (
            <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}