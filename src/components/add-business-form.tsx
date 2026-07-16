import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BusinessImportDialog } from "@/components/business-import-dialog";
import { AddBusinessBasicSection } from "@/components/add-business-basic-section";
import { AddBusinessCategoriesSection } from "@/components/add-business-categories-section";
import { AddBusinessContactSection } from "@/components/add-business-contact-section";
import { AddBusinessLocationSection } from "@/components/add-business-location-section";
import { AddBusinessMediaSection } from "@/components/add-business-media-section";
import { AddBusinessPreview } from "@/components/add-business-preview";
import { useAddBusinessForm } from "@/hooks/use-add-business-form";

export function AddBusinessForm() {
  const businessForm = useAddBusinessForm();

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

        <AddBusinessBasicSection
          form={businessForm.form}
          update={businessForm.update}
        />

        <AddBusinessCategoriesSection
          form={businessForm.form}
          setForm={businessForm.setForm}
        />

        <AddBusinessLocationSection
          form={businessForm.form}
          update={businessForm.update}
          barangayResults={businessForm.barangayResults}
          chooseBarangay={businessForm.chooseBarangay}
          useCurrentLocation={businessForm.useCurrentLocation}
          locating={businessForm.locating}
        />

        <AddBusinessContactSection
          form={businessForm.form}
          update={businessForm.update}
        />

        <AddBusinessMediaSection
          form={businessForm.form}
          update={businessForm.update}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
          <Button type="submit" size="lg" disabled={businessForm.submitting}>
            {businessForm.submitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save and manage business
          </Button>
        </div>
      </form>

      <AddBusinessPreview form={businessForm.form} />
    </div>
  );
}