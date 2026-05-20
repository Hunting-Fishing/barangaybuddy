// Curated PH-focused feature tags. Values are stable lowercase slugs stored in
// businesses.tags. Labels are what we show in the UI.

export type FeatureTag = { slug: string; label: string };
export type FeatureTagGroup = { id: string; label: string; tags: FeatureTag[] };

const t = (slug: string, label: string): FeatureTag => ({ slug, label });

export const FEATURE_TAG_GROUPS: FeatureTagGroup[] = [
  {
    id: "dining",
    label: "Dining & service",
    tags: [
      t("dine-in", "Dine-in"),
      t("take-out", "Take-out"),
      t("delivery", "Delivery"),
      t("drive-thru", "Drive-thru"),
      t("curbside-pickup", "Curbside pickup"),
      t("catering", "Catering"),
      t("reservations", "Reservations"),
      t("walk-ins", "Walk-ins welcome"),
      t("counter-service", "Counter service"),
      t("table-service", "Table service"),
      t("buffet", "Buffet / eat-all-you-can"),
      t("self-service", "Self-service"),
      t("function-room", "Function room"),
      t("private-room", "Private room"),
    ],
  },
  {
    id: "drinks-bar",
    label: "Drinks & bar",
    tags: [
      t("full-bar", "Full bar"),
      t("beer", "Beer"),
      t("draft-beer", "Draft beer"),
      t("wine", "Wine"),
      t("cocktails", "Cocktails"),
      t("local-spirits", "Local spirits (Tanduay/Emperador)"),
      t("imported-spirits", "Imported spirits"),
      t("inuman", "Inuman tambayan"),
      t("pulutan", "Pulutan"),
      t("happy-hour", "Happy hour"),
      t("byob", "BYOB"),
      t("shisha", "Shisha"),
      t("coffee", "Coffee"),
      t("milk-tea", "Milk tea"),
      t("juice-shake", "Juice / shake"),
      t("halo-halo", "Halo-halo"),
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    tags: [
      t("billiards", "Billiards / Pool"),
      t("darts", "Darts"),
      t("videoke", "Videoke / Karaoke"),
      t("live-band", "Live band"),
      t("dj", "DJ"),
      t("acoustic", "Acoustic nights"),
      t("beerpong", "Beerpong"),
      t("board-games", "Board games"),
      t("arcade", "Arcade"),
      t("gaming-pc", "Gaming PCs"),
      t("playstation", "PlayStation rental"),
      t("sports-tv", "Sports on TV"),
      t("boxing-mma", "Boxing / MMA nights"),
      t("sabong-viewing", "Sabong viewing"),
      t("ladies-night", "Ladies' night"),
    ],
  },
  {
    id: "amenities",
    label: "Amenities",
    tags: [
      t("public-restroom", "Public restroom"),
      t("aircon", "Air-conditioned"),
      t("electric-fan", "Electric fan only"),
      t("free-wifi", "Free WiFi"),
      t("charging-outlets", "Charging outlets"),
      t("parking", "Parking"),
      t("motorcycle-parking", "Motorcycle parking"),
      t("bike-parking", "Bike parking"),
      t("covered-parking", "Covered parking"),
      t("valet", "Valet"),
      t("cctv", "CCTV"),
      t("security-guard", "Security guard"),
      t("smoking-area", "Smoking area"),
      t("non-smoking", "Non-smoking"),
      t("outdoor-seating", "Outdoor seating"),
      t("al-fresco", "Al fresco"),
      t("rooftop", "Rooftop"),
      t("garden", "Garden"),
      t("beachfront", "Beachfront"),
      t("riverside", "Riverside / lakeside"),
      t("mountain-view", "Mountain view"),
      t("generator", "Generator (brownout-ready)"),
    ],
  },
  {
    id: "stay",
    label: "Stay & rooms",
    tags: [
      t("overnight", "Overnight stay"),
      t("day-use", "Day-use rooms"),
      t("hourly", "Hourly rooms"),
      t("camping", "Camping"),
      t("cottages", "Cottages"),
      t("cabanas", "Cabanas"),
      t("tents", "Tent rental"),
      t("hot-shower", "Hot shower"),
      t("pool-access", "Swimming pool access"),
    ],
  },
  {
    id: "accessibility-family",
    label: "Accessibility & family",
    tags: [
      t("wheelchair-accessible", "Wheelchair accessible"),
      t("pwd-ramp", "PWD ramp"),
      t("senior-friendly", "Senior-friendly"),
      t("kid-friendly", "Kid-friendly"),
      t("high-chairs", "High chairs"),
      t("play-area", "Kids' play area"),
      t("pet-friendly", "Pet-friendly"),
      t("breastfeeding-area", "Breastfeeding area"),
      t("baby-changing", "Baby changing station"),
    ],
  },
  {
    id: "payments",
    label: "Payments accepted",
    tags: [
      t("pay-cash", "Cash"),
      t("pay-gcash", "GCash"),
      t("pay-maya", "Maya"),
      t("pay-bank-transfer", "Bank transfer"),
      t("pay-card", "Credit / debit card"),
      t("pay-cod", "Cash on delivery"),
      t("pay-installment", "Installment"),
      t("pay-suki-lista", "Suki / Lista (credit)"),
      t("pay-grabpay", "GrabPay"),
      t("pay-shopeepay", "ShopeePay"),
    ],
  },
  {
    id: "services",
    label: "Goods & services on-site",
    tags: [
      t("lpg-refill", "LPG refill"),
      t("water-refill", "Water refill"),
      t("eload", "Load / e-load"),
      t("remittance", "Padala / remittance"),
      t("bills-payment", "Bills payment"),
      t("pera-padala", "Pera Padala"),
      t("printing", "Printing / Xerox"),
      t("lamination", "Lamination"),
      t("internet-cafe", "Internet café"),
      t("atm", "ATM"),
      t("atm-cash-in", "ATM cash-in"),
      t("notary", "Notary"),
      t("photo-id", "ID photo / passport photo"),
      t("repair-onsite", "Repair on-site"),
      t("rental", "Rentals"),
    ],
  },
  {
    id: "fresh-market",
    label: "Fresh & market",
    tags: [
      t("live-seafood", "Live seafood"),
      t("fresh-catch-daily", "Fresh catch daily"),
      t("fresh-meat", "Fresh meat"),
      t("organic", "Organic"),
      t("locally-sourced", "Locally sourced"),
      t("halal", "Halal"),
      t("vegetarian-options", "Vegetarian options"),
      t("vegan-options", "Vegan options"),
      t("gluten-free", "Gluten-free options"),
      t("frozen-goods", "Frozen goods"),
    ],
  },
  {
    id: "hours",
    label: "Hours",
    tags: [
      t("open-24-7", "Open 24/7"),
      t("open-early", "Open early (before 6am)"),
      t("open-late", "Open late (after 10pm)"),
      t("sunday-open", "Open Sundays"),
      t("holiday-open", "Open holidays"),
    ],
  },
  {
    id: "languages",
    label: "Languages spoken",
    tags: [
      t("lang-tagalog", "Tagalog"),
      t("lang-english", "English"),
      t("lang-bisaya", "Bisaya / Cebuano"),
      t("lang-ilocano", "Ilocano"),
      t("lang-hiligaynon", "Hiligaynon"),
      t("lang-waray", "Waray"),
      t("lang-bicol", "Bicol"),
      t("lang-kapampangan", "Kapampangan"),
    ],
  },
];

const TAG_LABEL_MAP = (() => {
  const m = new Map<string, string>();
  for (const g of FEATURE_TAG_GROUPS) for (const tag of g.tags) m.set(tag.slug, tag.label);
  return m;
})();

export function tagLabel(slug: string): string {
  return TAG_LABEL_MAP.get(slug) ?? slug;
}

export function isPresetTag(slug: string): boolean {
  return TAG_LABEL_MAP.has(slug);
}

// Allow custom free-text tags: letters, digits, spaces, & - ' . / +
const CUSTOM_RE = /^[\p{L}\p{N}\s&\-'./+]+$/u;

export function sanitizeCustomLabel(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 40) return null;
  if (!CUSTOM_RE.test(trimmed)) return null;
  return trimmed;
}

export function dedupeCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = it.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}
