import { Link } from "@tanstack/react-router";
import mapImg from "@/assets/ph-regions-map.png";

type Hotspot = {
  slug: string;
  short: string;
  name: string;
  /** percent from left/top of the image */
  x: number;
  y: number;
};

const HOTSPOTS: Hotspot[] = [
  { slug: "region-i", short: "I", name: "Ilocos Region", x: 26, y: 18 },
  { slug: "cordillera-administrative-region", short: "CAR", name: "Cordillera Administrative Region", x: 31, y: 24 },
  { slug: "region-ii", short: "II", name: "Cagayan Valley", x: 53, y: 21 },
  { slug: "region-iii", short: "III", name: "Central Luzon", x: 28, y: 33 },
  { slug: "national-capital-region", short: "NCR", name: "National Capital Region", x: 31, y: 40 },
  { slug: "region-iv-a", short: "IV-A", name: "CALABARZON", x: 52, y: 33 },
  { slug: "mimaropa-region", short: "IV-B", name: "MIMAROPA", x: 26, y: 46 },
  { slug: "region-v", short: "V", name: "Bicol Region", x: 62, y: 40 },
  { slug: "region-viii", short: "VIII", name: "Eastern Visayas", x: 70, y: 51 },
  { slug: "region-vi", short: "VI", name: "Western Visayas", x: 45, y: 60 },
  { slug: "region-vii", short: "VII", name: "Central Visayas", x: 48, y: 67 },
  { slug: "region-ix", short: "IX", name: "Zamboanga Peninsula", x: 38, y: 75 },
  { slug: "region-x", short: "X", name: "Northern Mindanao", x: 73, y: 73 },
  { slug: "region-xiii", short: "XIII", name: "Caraga", x: 75, y: 63 },
  { slug: "region-xi", short: "XI", name: "Davao Region", x: 74, y: 82 },
  { slug: "region-xii", short: "XII", name: "SOCCSKSARGEN", x: 58, y: 83 },
  { slug: "bangsamoro-autonomous-region-in-muslim-mindanao", short: "BARMM", name: "BARMM", x: 50, y: 79 },
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
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            <span className="relative flex items-center justify-center">
              <span className="absolute h-7 w-7 animate-ping rounded-full bg-primary/40 opacity-60 group-hover:opacity-100" />
              <span className="relative flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-background bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-md transition-transform group-hover:scale-125 group-focus-visible:scale-125">
                {h.short}
              </span>
            </span>
            <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {h.name}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Tap a region marker to explore its provinces, cities and barangays.
      </p>
    </div>
  );
}
