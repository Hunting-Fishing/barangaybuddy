import { useState } from "react";
import { Edit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddBusinessBasicSection } from "@/components/add-business-basic-section";
import { AddBusinessCategoriesSection } from "@/components/add-business-categories-section";
import { AddBusinessContactSection } from "@/components/add-business-contact-section";
import { AddBusinessLocationSection } from "@/components/add-business-location-section";
import { AddBusinessMediaSection } from "@/components/add-business-media-section";
import {
  useEditBusinessForm,
  type EditableBusiness,
} from "@/hooks/use-edit-business-form";

type Props = {
  business: EditableBusiness;
  onSaved: () => void;
};

export function EditBusinessDialog({ business, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const editor = useEditBusinessForm({
    business,
    open,
    onOpenChange: setOpen,
    onSaved,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Edit className="h-4 w-4" /> Edit business page
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit business page</DialogTitle>
          <DialogDescription>
            Update the public mini-site, directory listing, categories, contact details, and images.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={editor.save} className="space-y-5">
          <Tabs defaultValue="basics">
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
              <TabsTrigger value="images" className="rounded-xl py-2">
                Images
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="mt-5">
              <AddBusinessBasicSection form={editor.form} update={editor.update} />
            </TabsContent>

            <TabsContent value="categories" className="mt-5">
              <AddBusinessCategoriesSection
                form={editor.form}
                setForm={editor.setForm}
              />
            </TabsContent>

            <TabsContent value="location" className="mt-5">
              <AddBusinessLocationSection
                form={editor.form}
                update={editor.update}
                barangayResults={editor.barangayResults}
                chooseBarangay={editor.chooseBarangay}
                profileBarangay={null}
                useProfileBarangay={() => undefined}
                saveBarangayToProfile={() => undefined}
                savingProfileBarangay={false}
                useCurrentLocation={editor.useCurrentLocation}
                locating={editor.locating}
                showProfileTools={false}
              />
            </TabsContent>

            <TabsContent value="contact" className="mt-5">
              <AddBusinessContactSection form={editor.form} update={editor.update} />
            </TabsContent>

            <TabsContent value="images" className="mt-5">
              <AddBusinessMediaSection form={editor.form} update={editor.update} />
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 -mx-6 flex flex-wrap justify-end gap-2 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editor.saving} className="gap-2">
              {editor.saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save business page
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}