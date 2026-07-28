import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessImportDialog } from "@/components/business-import-dialog";
import { AddBusinessBasicSection } from "@/components/add-business-basic-section";
import { AddBusinessCategoriesSection } from "@/components/add-business-categories-section";
import { AddBusinessContactSection } from "@/components/add-business-contact-section";
import { AddBusinessLocationSection } from "@/components/add-business-location-section";
import { AddBusinessMediaSection } from "@/components/add-business-media-section";
import { AddBusinessPreview } from "@/components/add-business-preview";
import { useAddBusinessForm } from "@/hooks/use-add-business-form";

const TAB_ORDER = ["basics", "categories", "location", "contact", "photos"] as const;
type AddBusinessTab = (typeof TAB_ORDER)[number];

export function AddBusinessForm() {
  const businessForm = useAddBusinessForm();
  const [tab, setTab] = useState<AddBusinessTab>("basics");

  const tabIndex = TAB_ORDER.indexOf(tab);
  const canGoBack = tabIndex > 0;
  const canGoNext = tabIndex < TAB_ORDER.length - 1;

  const goBack = () => {
    if (!canGoBack) return;
    setTab(TAB_ORDER[tabIndex - 1]);
  };

  const goNext = () => {
    if (!canGoNext) return;
    setTab(TAB_ORDER[tabIndex + 1]);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form onSubmit={businessForm.submit} className="space-y-6">
        <Card className="border-primary/20 bg-primary/5 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-primary">
                Faster option
              </div>
              <h2 className="font-display text-xl font-bold">
                Have a Google, Facebook, or website link?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Let AI fill most details for you, or continue manually below.
              </p>
            </div>
            <BusinessImportDialog
              trigger={
                <Button type="button" variant="outline" className="gap-2">
                  <Sparkles className="h-4 w-4" /> Import from link
                </Button>
              }
            />
          </div>
        </Card>

        <Tabs value={tab} onValueChange={(value) => setTab(value as AddBusinessTab)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl p-1 sm:grid-cols-5">
            <TabsTrigger value="basics" className="rounded-xl py-2">
              Basics
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-xl py-2">
              Categories
            </TabsTrigger>
            <TabsTrigger value="location" className="rounded-xl py-2">
              Location
            </TabsTrigger>
            <TabsTrigger value="contact" className="rounded-xl py-2">
              Contact
            </TabsTrigger>
            <TabsTrigger value="photos" className="rounded-xl py-2">
              Photos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="mt-6">
            <AddBusinessBasicSection form={businessForm.form} update={businessForm.update} />
          </TabsContent>

          <TabsContent value="categories" className="mt-6">
            <AddBusinessCategoriesSection form={businessForm.form} setForm={businessForm.setForm} />
          </TabsContent>

          <TabsContent value="location" className="mt-6">
            <AddBusinessLocationSection
              form={businessForm.form}
              update={businessForm.update}
              barangayResults={businessForm.barangayResults}
              chooseBarangay={businessForm.chooseBarangay}
              profileBarangay={businessForm.profileBarangay}
              useProfileBarangay={businessForm.useProfileBarangay}
              saveBarangayToProfile={businessForm.saveBarangayToProfile}
              savingProfileBarangay={businessForm.savingProfileBarangay}
              useCurrentLocation={businessForm.useCurrentLocation}
              locating={businessForm.locating}
            />
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <AddBusinessContactSection form={businessForm.form} update={businessForm.update} />
          </TabsContent>

          <TabsContent value="photos" className="mt-6">
            <AddBusinessMediaSection form={businessForm.form} update={businessForm.update} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={!canGoBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
            {canGoNext && (
              <Button type="button" variant="outline" onClick={goNext} className="gap-2">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <Button type="submit" size="lg" disabled={businessForm.submitting}>
              {businessForm.submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and manage business
            </Button>
          </div>
        </div>
      </form>

      <AddBusinessPreview form={businessForm.form} />
    </div>
  );
}
