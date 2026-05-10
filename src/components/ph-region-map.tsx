import { Link } from "@tanstack/react-router";
import mapImg from "@/assets/ph-regions-map.png";

type Hotspot = {
  slug: string;
  short: string;
  name: string;
  /** percent from left/top of the image — placed on the visible map LABEL */
  x: number;
  y: number;
};

// Coordinates aligned to the label positions on the map image
const HOTSPOTS: Hotspot[] = [
  { slug: "region-i", short: "I", name: "Ilocos Region", x: 26, y: 18 },
  { slug: "cordillera-administrative-region", short: "CAR", name: "Cordillera Administrative Region", x: 26, y: 25 },
  { slug: "region-ii", short: "II", name: "Cagayan Valley", x: 57, y: 19 },
  { slug: "region-iii", short: "III", name: "Central Luzon", x: 25, y: 35 },
  { slug: "national-capital-region", short: "NCR", name: "National Capital Region", x: 26, y: 40 },
  { slug: "region-iv-a", short: "IV-A", name: "CALABARZON", x: 55, y: 34 },
  { slug: "mimaropa-region", short: "IV-B", name: "MIMAROPA", x: 25, y: 47 },
  { slug: "region-v", short: "V", name: "Bicol Region", x: 67, y: 39 },
  { slug: "region-viii", short: "VIII", name: "Eastern Visayas", x: 75, y: 50 },
  { slug: "region-vi", short: "VI", name: "Western Visayas", x: 45, y: 60 },
  { slug: "region-vii", short: "VII", name: "Central Visayas", x: 55, y: 65 },
  { slug: "region-ix", short: "IX", name: "Zamboanga Peninsula", x: 32, y: 75 },
  { slug: "region-x", short: "X", name: "Northern Mindanao", x: 70, y: 70 },
  { slug: "region-xiii", short: "XIII", name: "Caraga", x: 80, y: 60 },
  { slug: "region-xi", short: "XI", name: "Davao Region", x: 75, y: 82 },
  { slug: "region-xii", short: "XII", name: "SOCCSKSARGEN", x: 55, y: 82 },
  { slug: "bangsamoro-autonomous-region-in-muslim-mindanao", short: "BARMM", name: "BARMM", x: 45, y: 78 },
];

export function PhRegionMap() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="relative aspect-[1200/1280] overflow-hidden rounded-2xl border border-border bg-secondary/30 shadow-elegant">
        <img
          src={mapImg}
          alt="Map of the Philippines showing all 17 regions"
          className="absolute inset-0 h-full w-full object-contain"
          loading="lazy"
        />
        {HOTSPOTS.map((h) => (
          <Link
            key={h.slug}
            to="/regions/$region"
            params={{ region: h.slug }}
            aria-label={h.name}
            title={h.name}
            className="group absolute flex h-14 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md transition-colors hover:bg-primary/20 focus-visible:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            <span className="sr-only">{h.name}</span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Tap a region label on the map to open its page.
      </p>
    </div>
  );
}
