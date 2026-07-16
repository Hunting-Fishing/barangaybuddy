import { Link } from "@tanstack/react-router";
import { Clock, Globe, Mail, MapPin, MessageSquare, Package, Phone, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";
import { tagLabel } from "@/lib/business-tags";
import { formatPrice } from "@/lib/unit-price";

type MiniBusiness = {
  id: string;
  name: string;
  slug: string;
  type: BusinessType;
  additional_types?: BusinessType[] | null;
  custom_types?: string[] | null;
  tags?: string[] | null;
  description: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  hours: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  owner_id: string | null;
  barangays?: {
    name?: string;
    cities_municipalities?: {
      name?: string;
      provinces?: { name?: string } | null;
    } | null;
  } | null;
};

type MiniListing = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  unit: string | null;
  category: string | null;
  image_url: string | null;
  in_stock: boolean;
};

type Props = {
  business: MiniBusiness;
  listings: MiniListing[];
};

export function BusinessMiniSite({ business, listings }: Props) {
  const { user } = useAuth();
  const isOwner = user?.id === business.owner_id;
  const place = [
    business.barangays?.name ? `Barangay ${business.barangays.name}` : null,
    business.barangays?.cities_municipalities?.name,
    business.barangays?.cities_municipalities?.provinces?.name,
  ]
    .filter(Boolean)
    .join(", ");

  const categories = [
    BUSINESS_TYPE_LABEL[business.type],
    ...(business.additional_types ?? []).map((type) => BUSINESS_TYPE_LABEL[type]),
    ...(business.custom_types ?? []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {isOwner && (
        <div className="border-b border-primary/20 bg-primary/5">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              You are viewing your business mini-site as customers see it.
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to="/dashboard/business/$id" params={{ id: business.id }}>
                  <Settings className="mr-1 h-3.5 w-3.5" /> Manage business
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/dashboard/business/$id/inventory" params={{ id: business.id }}>
                  <Package className="mr-1 h-3.5 w-3.5" /> Inventory
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        {business.cover_image_url && (
          <img
            src={business.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
        )}
        <div className="relative container mx-auto px-4 py-16 text-primary-foreground md:py-24">
          <Link to="/" className="text-sm text-primary-foreground/80 hover:text-primary-foreground">
            BarangayHub
          </Link>
          <div className="mt-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 4).map((category) => (
                  <Badge key={category} className="bg-primary-foreground/15 text-primary-foreground">
                    {category}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4">
                {business.logo_url && (
                  <img
                    src={business.logo_url}
                    alt={`${business.name} logo`}
                    className="h-16 w-16 rounded-2xl bg-white object-cover p-1"
                  />
                )}
                <div>
                  <h1 className="font-display text-4xl font-bold md:text-6xl">
                    {business.name}
                  </h1>
                  {place && (
                    <p className="mt-2 flex items-center gap-1.5 text-primary-foreground/80">
                      <MapPin className="h-4 w-4" /> {place}
                    </p>
                  )}
                </div>
              </div>
              {business.description && (
                <p className="mt-6 max-w-2xl text-lg text-primary-foreground/85">
                  {business.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {business.contact_phone && (
                <Button className="bg-sun text-sun-foreground hover:bg-sun/90" asChild>
                  <a href={`tel:${business.contact_phone}`}>
                    <Phone className="mr-2 h-4 w-4" /> Call
                  </a>
                </Button>
              )}
              <Button variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <a href="#products">
                  View products
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {business.address && (
            <InfoCard icon={<MapPin className="h-5 w-5" />} label="Address" value={business.address} />
          )}
          {business.hours && (
            <InfoCard icon={<Clock className="h-5 w-5" />} label="Hours" value={business.hours} />
          )}
          {business.contact_phone && (
            <InfoCard icon={<Phone className="h-5 w-5" />} label="Phone" value={business.contact_phone} href={`tel:${business.contact_phone}`} />
          )}
          {business.website && (
            <InfoCard icon={<Globe className="h-5 w-5" />} label="Website" value="Open website" href={business.website} />
          )}
          {business.contact_email && (
            <InfoCard icon={<Mail className="h-5 w-5" />} label="Email" value={business.contact_email} href={`mailto:${business.contact_email}`} />
          )}
        </section>

        {Array.isArray(business.tags) && business.tags.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold">Features</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {business.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tagLabel(tag)}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <section id="products" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl font-bold">Products & services</h2>
              <p className="mt-1 text-muted-foreground">
                Browse current public listings from this business.
              </p>
            </div>
            {business.contact_phone && (
              <Button variant="outline" asChild>
                <a href={`tel:${business.contact_phone}`}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Ask about availability
                </a>
              </Button>
            )}
          </div>

          {listings.length === 0 ? (
            <Card className="mt-5 p-8 text-center text-sm text-muted-foreground">
              No public products or services have been listed yet.
            </Card>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden transition-all hover:-translate-y-1 hover:shadow-elegant">
                  <div className="aspect-video bg-muted">
                    {listing.image_url && (
                      <img
                        src={listing.image_url}
                        alt={listing.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {listing.category && (
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {listing.category}
                          </div>
                        )}
                        <h3 className="mt-1 font-display text-lg font-bold">{listing.name}</h3>
                      </div>
                      <div className="text-right font-display text-lg font-bold text-primary">
                        {formatPrice(listing.price)}
                      </div>
                    </div>
                    {listing.description && (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {listing.description}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant={listing.in_stock ? "secondary" : "outline"}>
                        {listing.in_stock ? "In stock" : "Out of stock"}
                      </Badge>
                      {listing.unit && <Badge variant="outline">{listing.unit}</Badge>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border bg-secondary/40 py-8 text-center text-sm text-muted-foreground">
        <div className="container mx-auto px-4">
          <div className="font-display text-base font-bold text-foreground">{business.name}</div>
          <div className="mt-1">Powered by BarangayHub</div>
        </div>
      </footer>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <Card className="flex h-full items-start gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 break-words text-sm font-medium">{value}</div>
      </div>
    </Card>
  );

  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {content}
    </a>
  ) : (
    content
  );
}