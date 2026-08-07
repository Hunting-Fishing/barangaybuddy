import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="container mx-auto grid gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-sun">
              <MapPin className="h-4 w-4 text-sun-foreground" />
            </div>
            <span className="font-display text-base font-bold">BarangayHub</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            The Philippines' nationwide network of barangay-level businesses, services and food.
          </p>
        </div>
        <div>
          <h4 className="font-display text-sm font-bold">Discover</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/regions" className="hover:text-foreground">
                Browse by region
              </Link>
            </li>
            <li>
              <Link to="/search" search={{ q: "", types: [], customTypes: [], tags: [], category: undefined, page: 1 }} className="hover:text-foreground">
                Search businesses
              </Link>
            </li>
            <li>
              <Link to="/fuel" className="hover:text-foreground">
                Fuel prices
              </Link>
            </li>
            <li>
              <Link to="/spotlight" className="hover:text-foreground">
                Spotlight Network
              </Link>
            </li>
            <li>
              <Link to="/spotlight/leaderboard" className="hover:text-foreground">
                Talent leaderboard
              </Link>
            </li>
            <li>
              <Link to="/family" className="hover:text-foreground">
                Family account
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-bold">For Businesses</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/signup" className="hover:text-foreground">
                List your business
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className="hover:text-foreground">
                Owner dashboard
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-bold">Coverage</h4>
          <p className="mt-3 text-sm text-muted-foreground">
            Built for all <strong className="text-foreground">42,011 barangays</strong> across the
            Philippines.
          </p>
        </div>
      </div>
      <div className="space-y-1 border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} BarangayHub. Para sa Pilipino, gawa ng Pilipino.</div>
        <div>
          Flags &amp; seals via{" "}
          <a
            href="https://commons.wikimedia.org/wiki/Flags_of_cities_and_municipalities_in_the_Philippines"
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-foreground"
          >
            Wikimedia Commons
          </a>
          .
        </div>
      </div>
    </footer>
  );
}
