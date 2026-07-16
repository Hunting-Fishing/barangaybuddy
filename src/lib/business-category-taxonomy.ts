import type { BusinessType } from "@/lib/business-types";

export type BusinessCategoryIcon =
  | "food"
  | "retail"
  | "vehicle"
  | "construction"
  | "health"
  | "services"
  | "market"
  | "agriculture";

export type BusinessCategoryItem = {
  id: string;
  label: string;
  description: string;
  businessType?: BusinessType;
  customType?: string;
  keywords: string[];
};

export type BusinessCategoryGroup = {
  id: string;
  label: string;
  description: string;
  icon: BusinessCategoryIcon;
  items: BusinessCategoryItem[];
};

const item = (
  id: string,
  label: string,
  description: string,
  options: {
    businessType?: BusinessType;
    customType?: string;
    keywords?: string[];
  },
): BusinessCategoryItem => ({
  id,
  label,
  description,
  businessType: options.businessType,
  customType: options.customType,
  keywords: options.keywords ?? [],
});

export const BUSINESS_CATEGORY_GROUPS: BusinessCategoryGroup[] = [
  {
    id: "food-drinks",
    label: "Food & drinks",
    description: "Restaurants, carinderias, bakeries, cafés, food carts, and catering.",
    icon: "food",
    items: [
      item("restaurant", "Restaurant", "Dine-in or full food service business.", {
        businessType: "restaurant",
        keywords: ["food", "meal", "dining", "eatery", "kainan"],
      }),
      item("carinderia", "Carinderia / eatery", "Local cooked food, turo-turo, or lutong bahay.", {
        businessType: "restaurant",
        customType: "Carinderia",
        keywords: ["ulam", "lutong bahay", "turo turo", "canteen"],
      }),
      item("food-vendor", "Food vendor", "Small food stall, kiosk, or prepared food seller.", {
        businessType: "food_vendor",
        keywords: ["street food", "stall", "kiosk", "snacks"],
      }),
      item("bakery", "Bakery", "Bread, pastries, cakes, or panaderya.", {
        businessType: "bakery",
        keywords: ["bread", "cake", "pastry", "pan de sal", "panaderya"],
      }),
      item("cafe", "Café / coffee shop", "Coffee, snacks, milk tea, or desserts.", {
        businessType: "restaurant",
        customType: "Cafe",
        keywords: ["coffee", "milk tea", "dessert", "tea", "frappe"],
      }),
      item("catering", "Catering", "Food trays, party packages, and event food service.", {
        businessType: "restaurant",
        customType: "Catering",
        keywords: ["party", "event", "food trays", "bilao"],
      }),
    ],
  },
  {
    id: "retail-essentials",
    label: "Retail & essentials",
    description: "Sari-sari stores, groceries, convenience stores, pharmacies, and daily needs.",
    icon: "retail",
    items: [
      item("sari-sari", "Sari-sari store", "Neighborhood convenience and daily essentials.", {
        businessType: "sari_sari",
        keywords: ["tingi", "load", "snacks", "neighborhood store"],
      }),
      item("store", "General store", "Retail store for goods and household items.", {
        businessType: "store",
        keywords: ["shop", "retail", "goods", "general merchandise"],
      }),
      item("convenience-store", "Convenience store", "Mini mart, grocery, or quick-stop store.", {
        businessType: "store",
        customType: "Convenience store",
        keywords: ["grocery", "mini mart", "24 hours", "711", "alfamart"],
      }),
      item("pharmacy", "Pharmacy / drugstore", "Medicine, health supplies, or botika.", {
        businessType: "pharmacy",
        keywords: ["medicine", "botika", "drugstore", "medical supplies"],
      }),
      item("dry-goods", "Dry goods", "Clothes, textiles, school supplies, or household goods.", {
        businessType: "dry_goods",
        keywords: ["clothes", "textile", "school supplies", "general merchandise"],
      }),
      item("water-refilling", "Water refilling station", "Purified water, mineral water, or delivery.", {
        businessType: "store",
        customType: "Water refilling station",
        keywords: ["water", "refill", "mineral", "purified", "delivery"],
      }),
      item("lpg-dealer", "LPG dealer", "Gasul, LPG tanks, refills, or home delivery.", {
        businessType: "store",
        customType: "LPG dealer",
        keywords: ["gasul", "lpg", "tank", "cylinder", "stove"],
      }),
    ],
  },
  {
    id: "vehicle-transport",
    label: "Vehicle & transport",
    description: "Repair shops, delivery, transport services, terminals, parts, and fuel.",
    icon: "vehicle",
    items: [
      item("transport", "Transport service", "Tricycle, jeepney, shuttle, van, or logistics service.", {
        businessType: "transport",
        keywords: ["tricycle", "jeepney", "van", "shuttle", "logistics"],
      }),
      item("delivery", "Delivery / courier", "Parcel, food, document, or local delivery service.", {
        businessType: "transport",
        customType: "Delivery service",
        keywords: ["courier", "rider", "parcel", "pabili", "padala"],
      }),
      item("repair-shop", "Vehicle repair shop", "Motorcycle, car, bicycle, or equipment repair.", {
        businessType: "repair_shop",
        keywords: ["mechanic", "motorcycle", "auto", "bike", "repair"],
      }),
      item("vulcanizing", "Vulcanizing / tire service", "Tire repair, patching, air, or wheel service.", {
        businessType: "repair_shop",
        customType: "Vulcanizing shop",
        keywords: ["tire", "gulong", "hangin", "patch", "flat tire"],
      }),
      item("car-wash", "Car wash / detailing", "Car wash, motorcycle wash, or auto detailing.", {
        businessType: "service",
        customType: "Car wash",
        keywords: ["detailing", "motor wash", "auto spa", "cleaning"],
      }),
      item("fuel-station", "Fuel station", "Gasoline, diesel, or fuel retail station.", {
        businessType: "fuel_station",
        keywords: ["gas station", "diesel", "gasoline", "petron", "shell"],
      }),
      item("vehicle-parts", "Vehicle parts & accessories", "Motorcycle, car, bike parts, oil, and accessories.", {
        businessType: "store",
        customType: "Vehicle parts store",
        keywords: ["parts", "accessories", "motorcycle parts", "auto supply", "oil"],
      }),
    ],
  },
  {
    id: "construction-home",
    label: "Construction & home",
    description: "Hardware, contractors, plumbers, electricians, welding, carpentry, and home services.",
    icon: "construction",
    items: [
      item("hardware", "Hardware", "Construction supplies, tools, paint, plumbing, and electrical goods.", {
        businessType: "hardware",
        keywords: ["tools", "cement", "paint", "plywood", "construction supplies"],
      }),
      item("construction-contractor", "Construction contractor", "House building, renovation, or project contractor.", {
        businessType: "service",
        customType: "Construction contractor",
        keywords: ["builder", "renovation", "house", "contractor", "mason"],
      }),
      item("plumber", "Plumbing service", "Pipe repair, water line, drainage, and fixture work.", {
        businessType: "service",
        customType: "Plumbing service",
        keywords: ["tubero", "pipe", "drainage", "faucet", "water line"],
      }),
      item("electrician", "Electrical service", "Wiring, repair, lighting, breakers, and electrical installation.", {
        businessType: "service",
        customType: "Electrical service",
        keywords: ["electrician", "wiring", "breaker", "lighting", "installation"],
      }),
      item("welding", "Welding / metal works", "Gates, grills, roof frames, and metal fabrication.", {
        businessType: "service",
        customType: "Welding shop",
        keywords: ["welder", "metal", "gate", "grill", "fabrication"],
      }),
      item("carpentry", "Carpentry / furniture", "Woodwork, cabinets, furniture, and home fixtures.", {
        businessType: "service",
        customType: "Carpentry service",
        keywords: ["wood", "cabinet", "furniture", "door", "table"],
      }),
    ],
  },
  {
    id: "health-beauty",
    label: "Health, beauty & wellness",
    description: "Clinics, dental care, pharmacies, salons, barbers, massage, and personal care.",
    icon: "health",
    items: [
      item("clinic", "Clinic", "Medical consultation, checkups, or barangay-level health service.", {
        businessType: "service",
        customType: "Clinic",
        keywords: ["doctor", "medical", "checkup", "health", "laboratory"],
      }),
      item("dental", "Dental clinic", "Dental checkups, cleaning, braces, extraction, or dentures.", {
        businessType: "service",
        customType: "Dental clinic",
        keywords: ["dentist", "teeth", "braces", "cleaning", "bunot"],
      }),
      item("veterinary", "Veterinary clinic", "Pet care, animal clinic, grooming, or supplies.", {
        businessType: "service",
        customType: "Veterinary clinic",
        keywords: ["vet", "pet", "dog", "cat", "animal"],
      }),
      item("salon", "Salon", "Hair, nails, makeup, lashes, or beauty care.", {
        businessType: "salon",
        keywords: ["beauty", "hair", "nails", "makeup", "parlor"],
      }),
      item("barber", "Barber shop", "Men’s haircut, shave, grooming, or hair styling.", {
        businessType: "salon",
        customType: "Barber shop",
        keywords: ["haircut", "gupit", "shave", "barbero"],
      }),
      item("massage", "Massage / spa", "Massage, wellness, body care, or spa services.", {
        businessType: "service",
        customType: "Massage spa",
        keywords: ["hilot", "spa", "wellness", "body massage"],
      }),
    ],
  },
  {
    id: "local-services",
    label: "Local services",
    description: "Laundry, printing, remittance, repair, internet cafés, tailoring, and errands.",
    icon: "services",
    items: [
      item("service", "General service", "Professional, local, or home-based service provider.", {
        businessType: "service",
        keywords: ["services", "business service", "professional"],
      }),
      item("laundry", "Laundry", "Wash, dry, fold, pressing, or pickup laundry service.", {
        businessType: "laundry",
        keywords: ["wash", "dry", "plantsa", "labada"],
      }),
      item("printing", "Printing / photocopy", "Printing, xerox, lamination, ID photo, or school needs.", {
        businessType: "service",
        customType: "Printing shop",
        keywords: ["xerox", "lamination", "photo", "school", "documents"],
      }),
      item("remittance", "Remittance / bills payment", "Padala, bills payment, cash-in, or money services.", {
        businessType: "service",
        customType: "Remittance center",
        keywords: ["gcash", "maya", "palawan", "cebuana", "bills"],
      }),
      item("internet-cafe", "Internet café / computer shop", "Computer rental, gaming, printing, or online services.", {
        businessType: "service",
        customType: "Internet cafe",
        keywords: ["computer", "pisonet", "gaming", "online", "typing"],
      }),
      item("tailoring", "Tailoring / dressmaker", "Clothing repair, uniforms, alterations, or sewing.", {
        businessType: "service",
        customType: "Tailoring shop",
        keywords: ["sewing", "alteration", "uniform", "dressmaker", "mananahi"],
      }),
    ],
  },
  {
    id: "markets-vendors",
    label: "Markets & vendors",
    description: "Wet markets, dry markets, public market vendors, ambulant vendors, and stalls.",
    icon: "market",
    items: [
      item("market-vendor", "Market vendor", "Public market stall or vendor.", {
        businessType: "market_vendor",
        keywords: ["palengke", "stall", "market", "vendor"],
      }),
      item("wet-market", "Wet market", "Fresh meat, seafood, vegetables, or public wet market.", {
        businessType: "wet_market",
        keywords: ["meat", "fish", "seafood", "vegetables", "palengke"],
      }),
      item("ambulant-vendor", "Ambulant vendor", "Mobile vendor, cart, walking seller, or roaming vendor.", {
        businessType: "ambulant_vendor",
        keywords: ["mobile", "cart", "street", "roaming", "taho"],
      }),
      item("rice-retailer", "Rice retailer", "Bigas, rice sacks, rice dealer, or grain store.", {
        businessType: "store",
        customType: "Rice retailer",
        keywords: ["bigas", "rice", "grain", "sack", "palay"],
      }),
      item("meat-shop", "Meat shop", "Fresh meat, frozen meat, poultry, or butcher shop.", {
        businessType: "store",
        customType: "Meat shop",
        keywords: ["meat", "pork", "chicken", "beef", "butcher"],
      }),
    ],
  },
  {
    id: "agriculture-fisheries",
    label: "Agriculture & fisheries",
    description: "Farmers, fishers, livestock, agri-supply, feeds, seedlings, and local producers.",
    icon: "agriculture",
    items: [
      item("farmer", "Farmer / produce seller", "Farm produce, crops, fruits, vegetables, or local harvest.", {
        businessType: "farmer",
        keywords: ["farm", "vegetables", "fruit", "harvest", "palay"],
      }),
      item("fisher", "Fisher / seafood seller", "Fresh fish, seafood, dried fish, or catch-of-the-day.", {
        businessType: "fisher",
        keywords: ["fish", "seafood", "isda", "tuyo", "catch"],
      }),
      item("livestock", "Livestock", "Poultry, pigs, goats, cattle, eggs, or animal raising.", {
        businessType: "livestock",
        keywords: ["poultry", "pig", "goat", "cow", "eggs"],
      }),
      item("agri-supply", "Agri supply", "Feeds, fertilizer, seeds, tools, pesticides, and farm inputs.", {
        businessType: "agri_supply",
        keywords: ["feeds", "fertilizer", "seeds", "pesticide", "farm supply"],
      }),
      item("rice-mill", "Rice mill", "Rice milling, palay buying, drying, or grain processing.", {
        businessType: "agri_supply",
        customType: "Rice mill",
        keywords: ["palay", "milling", "grain", "drying", "bigasan"],
      }),
    ],
  },
];

export function businessCategoryItemKey(item: BusinessCategoryItem) {
  return item.customType
    ? `custom:${item.customType.toLowerCase()}`
    : `type:${item.businessType ?? item.id}`;
}

export function getBusinessCategorySuggestions(query: string) {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  return BUSINESS_CATEGORY_GROUPS.flatMap((group) =>
    group.items.map((categoryItem) => {
      const fields = [
        categoryItem.label,
        categoryItem.description,
        categoryItem.businessType ?? "",
        categoryItem.customType ?? "",
        ...categoryItem.keywords,
      ].map((value) => value.toLowerCase());

      const label = categoryItem.label.toLowerCase();
      const startsWith = label.startsWith(needle);
      const includesLabel = label.includes(needle);
      const includesAny = fields.some((field) => field.includes(needle));

      if (!includesAny) return null;

      return {
        ...categoryItem,
        groupLabel: group.label,
        score: startsWith ? 0 : includesLabel ? 1 : 2,
      };
    }),
  )
    .filter((result): result is BusinessCategoryItem & { groupLabel: string; score: number } => result !== null)
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .slice(0, 8);
}