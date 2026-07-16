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
  section?: string;
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
    section?: string;
    keywords?: string[];
  },
): BusinessCategoryItem => ({
  id,
  label,
  description,
  businessType: options.businessType,
  customType: options.customType,
  section: options.section,
  keywords: options.keywords ?? [],
});

const foodSection = {
  restaurants: "Restaurants & cooked meals",
  vendors: "Food vendor specialties",
  drinksDesserts: "Drinks, desserts & merienda",
  mobile: "Mobile / roaming vendors",
  bakeryEvents: "Bakery, café & events",
};

export const BUSINESS_CATEGORY_GROUPS: BusinessCategoryGroup[] = [
  {
    id: "food-drinks",
    label: "Food & drinks",
    description:
      "Restaurants, carinderias, bakeries, cafés, food carts, street food, merienda, drinks, and catering.",
    icon: "food",
    items: [
      item("restaurant", "Restaurant", "Dine-in or full food service business.", {
        businessType: "restaurant",
        section: foodSection.restaurants,
        keywords: ["food", "meal", "dining", "eatery", "kainan"],
      }),
      item(
        "buffet-restaurant",
        "Buffet restaurant",
        "Eat-all-you-can, buffet, samgyupsal, hotpot, or unlimited dining.",
        {
          businessType: "restaurant",
          customType: "Buffet restaurant",
          section: foodSection.restaurants,
          keywords: [
            "buffet",
            "eat all you can",
            "unli",
            "samgyupsal",
            "hotpot",
            "unlimited",
          ],
        },
      ),
      item("carinderia", "Carinderia / eatery", "Local cooked food, turo-turo, or lutong bahay.", {
        businessType: "restaurant",
        customType: "Carinderia",
        section: foodSection.restaurants,
        keywords: ["ulam", "lutong bahay", "turo turo", "canteen"],
      }),
      item("silog-tapsihan", "Silog / tapsihan", "Tapsilog, longsilog, tocilog, breakfast meals, or tapsihan.", {
        businessType: "restaurant",
        customType: "Silog restaurant",
        section: foodSection.restaurants,
        keywords: ["tapsilog", "longsilog", "tocilog", "breakfast", "tapsihan"],
      }),
      item("pares-mami-vendor", "Pares / mami vendor", "Beef pares, mami, goto, lugaw, arroz caldo, or noodle soup stall.", {
        businessType: "food_vendor",
        customType: "Pares vendor",
        section: foodSection.restaurants,
        keywords: ["pares", "mami", "goto", "lugaw", "arroz caldo", "noodle soup"],
      }),
      item("pancit-palabok-vendor", "Pancit / palabok vendor", "Pancit, palabok, bihon, canton, bilao orders, or noodle trays.", {
        businessType: "food_vendor",
        customType: "Pancit vendor",
        section: foodSection.restaurants,
        keywords: ["pancit", "palabok", "bihon", "canton", "bilao", "noodles"],
      }),
      item("food-vendor", "Food vendor", "Small food stall, kiosk, or prepared food seller.", {
        businessType: "food_vendor",
        section: foodSection.vendors,
        keywords: ["street food", "stall", "kiosk", "snacks"],
      }),
      item("empanada-vendor", "Empanada vendor", "Empanada stall, Ilocos empanada, merienda, or fried snack seller.", {
        businessType: "food_vendor",
        customType: "Empanada vendor",
        section: foodSection.vendors,
        keywords: ["empanada", "ilocos empanada", "fried snack", "merienda", "stall"],
      }),
      item("sisig-vendor", "Sisig vendor", "Sisig stall, sizzling sisig, pork sisig, chicken sisig, or pulutan seller.", {
        businessType: "food_vendor",
        customType: "Sisig vendor",
        section: foodSection.vendors,
        keywords: ["sisig", "sizzling", "pulutan", "pork sisig", "chicken sisig"],
      }),
      item("ihaw-ihaw-vendor", "Ihaw-ihaw / BBQ vendor", "Barbecue, isaw, tenga, betamax, grilled liempo, or street grill.", {
        businessType: "food_vendor",
        customType: "Ihaw-ihaw vendor",
        section: foodSection.vendors,
        keywords: ["bbq", "barbecue", "isaw", "grill", "ihaw", "liempo", "street food"],
      }),
      item("siomai-vendor", "Siomai vendor", "Siomai stall, steamed dumplings, chili garlic, or rice meals.", {
        businessType: "food_vendor",
        customType: "Siomai vendor",
        section: foodSection.vendors,
        keywords: ["siomai", "dumplings", "chili garlic", "rice meal", "steamed"],
      }),
      item("shawarma-vendor", "Shawarma vendor", "Shawarma rice, wrap, kebab-style stall, or Middle Eastern snack seller.", {
        businessType: "food_vendor",
        customType: "Shawarma vendor",
        section: foodSection.vendors,
        keywords: ["shawarma", "wrap", "shawarma rice", "kebab", "garlic sauce"],
      }),
      item("burger-stand", "Burger stand", "Burger cart, buy-one-take-one burgers, sandwiches, or quick snacks.", {
        businessType: "food_vendor",
        customType: "Burger stand",
        section: foodSection.vendors,
        keywords: ["burger", "sandwich", "buy one take one", "snacks", "stand"],
      }),
      item("kwek-kwek-fishball-vendor", "Kwek-kwek / fishball vendor", "Kwek-kwek, fishball, kikiam, squid ball, sauces, or tusok-tusok snacks.", {
        businessType: "food_vendor",
        customType: "Kwek-kwek vendor",
        section: foodSection.vendors,
        keywords: ["kwek kwek", "fishball", "kikiam", "squid ball", "tusok tusok"],
      }),
      item("lechon-manok-vendor", "Lechon manok / liempo", "Roasted chicken, liempo, rotisserie, or take-home roasted meat.", {
        businessType: "food_vendor",
        customType: "Lechon manok vendor",
        section: foodSection.vendors,
        keywords: ["lechon manok", "liempo", "roasted chicken", "rotisserie", "takeout"],
      }),
      item("lechon-baboy-vendor", "Lechon baboy / lechon belly", "Whole lechon, lechon belly, party trays, or roasted pork orders.", {
        businessType: "food_vendor",
        customType: "Lechon baboy vendor",
        section: foodSection.vendors,
        keywords: ["lechon", "lechon belly", "roasted pork", "party", "whole lechon"],
      }),
      item("chicken-wings-vendor", "Chicken wings seller", "Flavored wings, fried chicken, boneless chicken, or rice meals.", {
        businessType: "food_vendor",
        customType: "Chicken wings seller",
        section: foodSection.vendors,
        keywords: ["wings", "fried chicken", "boneless", "chicken", "rice meal"],
      }),
      item("pizza-vendor", "Pizza / pasta seller", "Pizza, pasta trays, baked macaroni, lasagna, or party food.", {
        businessType: "food_vendor",
        customType: "Pizza seller",
        section: foodSection.vendors,
        keywords: ["pizza", "pasta", "lasagna", "baked macaroni", "party food"],
      }),
      item("turon-banana-cue-vendor", "Turon / banana cue vendor", "Turon, banana cue, camote cue, maruya, or fried saba vendor.", {
        businessType: "food_vendor",
        customType: "Turon vendor",
        section: foodSection.drinksDesserts,
        keywords: ["turon", "banana cue", "camote cue", "maruya", "saba", "merienda"],
      }),
      item("kakanin-vendor", "Kakanin vendor", "Bibingka, puto, kutsinta, sapin-sapin, biko, suman, or native delicacies.", {
        businessType: "food_vendor",
        customType: "Kakanin vendor",
        section: foodSection.drinksDesserts,
        keywords: ["kakanin", "puto", "kutsinta", "bibingka", "suman", "biko", "sapin sapin"],
      }),
      item("halo-halo-vendor", "Halo-halo / dessert vendor", "Halo-halo, mais con hielo, ice scramble, banana split, or cold desserts.", {
        businessType: "food_vendor",
        customType: "Halo-halo vendor",
        section: foodSection.drinksDesserts,
        keywords: ["halo halo", "ice scramble", "mais con hielo", "dessert", "cold drinks"],
      }),
      item("dirty-ice-cream-vendor", "Sorbetes / dirty ice cream vendor", "Sorbetes cart, ice cream sandwich, cone, cup, or street ice cream.", {
        businessType: "ambulant_vendor",
        customType: "Sorbetes vendor",
        section: foodSection.drinksDesserts,
        keywords: ["sorbetes", "dirty ice cream", "ice cream", "cart", "cone"],
      }),
      item("fruit-shake-milk-tea", "Fruit shake / milk tea stand", "Fruit shakes, milk tea, lemonade, gulaman, or cold drinks.", {
        businessType: "food_vendor",
        customType: "Drink stand",
        section: foodSection.drinksDesserts,
        keywords: ["fruit shake", "milk tea", "lemonade", "gulaman", "cold drinks"],
      }),
      item("buko-juice-vendor", "Buko juice / coconut vendor", "Fresh buko, buko juice, coconut shake, or coconut-based drinks.", {
        businessType: "food_vendor",
        customType: "Buko juice vendor",
        section: foodSection.drinksDesserts,
        keywords: ["buko", "coconut", "buko juice", "coconut shake", "fresh juice"],
      }),
      item("balut-vendor", "Balut / penoy vendor", "Balut, penoy, salted egg, or evening street food vendor.", {
        businessType: "ambulant_vendor",
        customType: "Balut vendor",
        section: foodSection.mobile,
        keywords: ["balut", "penoy", "salted egg", "street food", "night vendor"],
      }),
      item("taho-vendor", "Taho vendor", "Taho, arnibal, sago, or roaming morning snack vendor.", {
        businessType: "ambulant_vendor",
        customType: "Taho vendor",
        section: foodSection.mobile,
        keywords: ["taho", "arnibal", "sago", "morning", "roaming vendor"],
      }),
      item("ambulant-food-vendor", "Roaming food vendor", "Mobile food seller, cart vendor, walking vendor, or route-based seller.", {
        businessType: "ambulant_vendor",
        customType: "Roaming food vendor",
        section: foodSection.mobile,
        keywords: ["roaming", "walking vendor", "cart", "mobile vendor", "street"],
      }),
      item("bakery", "Bakery", "Bread, pastries, cakes, or panaderya.", {
        businessType: "bakery",
        section: foodSection.bakeryEvents,
        keywords: ["bread", "cake", "pastry", "pan de sal", "panaderya"],
      }),
      item("cafe", "Café / coffee shop", "Coffee, snacks, milk tea, or desserts.", {
        businessType: "restaurant",
        customType: "Cafe",
        section: foodSection.bakeryEvents,
        keywords: ["coffee", "milk tea", "dessert", "tea", "frappe"],
      }),
      item("catering", "Catering", "Food trays, party packages, and event food service.", {
        businessType: "restaurant",
        customType: "Catering",
        section: foodSection.bakeryEvents,
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
        section: "Daily essentials",
        keywords: ["tingi", "load", "snacks", "neighborhood store"],
      }),
      item("store", "General store", "Retail store for goods and household items.", {
        businessType: "store",
        section: "Daily essentials",
        keywords: ["shop", "retail", "goods", "general merchandise"],
      }),
      item("convenience-store", "Convenience store", "Mini mart, grocery, or quick-stop store.", {
        businessType: "store",
        customType: "Convenience store",
        section: "Daily essentials",
        keywords: ["grocery", "mini mart", "24 hours", "711", "alfamart"],
      }),
      item("pharmacy", "Pharmacy / drugstore", "Medicine, health supplies, or botika.", {
        businessType: "pharmacy",
        section: "Health essentials",
        keywords: ["medicine", "botika", "drugstore", "medical supplies"],
      }),
      item("dry-goods", "Dry goods", "Clothes, textiles, school supplies, or household goods.", {
        businessType: "dry_goods",
        section: "General merchandise",
        keywords: ["clothes", "textile", "school supplies", "general merchandise"],
      }),
      item("water-refilling", "Water refilling station", "Purified water, mineral water, or delivery.", {
        businessType: "store",
        customType: "Water refilling station",
        section: "Home supplies",
        keywords: ["water", "refill", "mineral", "purified", "delivery"],
      }),
      item("lpg-dealer", "LPG dealer", "Gasul, LPG tanks, refills, or home delivery.", {
        businessType: "store",
        customType: "LPG dealer",
        section: "Home supplies",
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
        section: "Transport",
        keywords: ["tricycle", "jeepney", "van", "shuttle", "logistics"],
      }),
      item("delivery", "Delivery / courier", "Parcel, food, document, or local delivery service.", {
        businessType: "transport",
        customType: "Delivery service",
        section: "Transport",
        keywords: ["courier", "rider", "parcel", "pabili", "padala"],
      }),
      item("repair-shop", "Vehicle repair shop", "Motorcycle, car, bicycle, or equipment repair.", {
        businessType: "repair_shop",
        section: "Vehicle care",
        keywords: ["mechanic", "motorcycle", "auto", "bike", "repair"],
      }),
      item("vulcanizing", "Vulcanizing / tire service", "Tire repair, patching, air, or wheel service.", {
        businessType: "repair_shop",
        customType: "Vulcanizing shop",
        section: "Vehicle care",
        keywords: ["tire", "gulong", "hangin", "patch", "flat tire"],
      }),
      item("car-wash", "Car wash / detailing", "Car wash, motorcycle wash, or auto detailing.", {
        businessType: "service",
        customType: "Car wash",
        section: "Vehicle care",
        keywords: ["detailing", "motor wash", "auto spa", "cleaning"],
      }),
      item("fuel-station", "Fuel station", "Gasoline, diesel, or fuel retail station.", {
        businessType: "fuel_station",
        section: "Fuel",
        keywords: ["gas station", "diesel", "gasoline", "petron", "shell"],
      }),
      item("vehicle-parts", "Vehicle parts & accessories", "Motorcycle, car, bike parts, oil, and accessories.", {
        businessType: "store",
        customType: "Vehicle parts store",
        section: "Vehicle supplies",
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
        section: "Supplies",
        keywords: ["tools", "cement", "paint", "plywood", "construction supplies"],
      }),
      item("construction-contractor", "Construction contractor", "House building, renovation, or project contractor.", {
        businessType: "service",
        customType: "Construction contractor",
        section: "Builders & repair",
        keywords: ["builder", "renovation", "house", "contractor", "mason"],
      }),
      item("plumber", "Plumbing service", "Pipe repair, water line, drainage, and fixture work.", {
        businessType: "service",
        customType: "Plumbing service",
        section: "Builders & repair",
        keywords: ["tubero", "pipe", "drainage", "faucet", "water line"],
      }),
      item("electrician", "Electrical service", "Wiring, repair, lighting, breakers, and electrical installation.", {
        businessType: "service",
        customType: "Electrical service",
        section: "Builders & repair",
        keywords: ["electrician", "wiring", "breaker", "lighting", "installation"],
      }),
      item("welding", "Welding / metal works", "Gates, grills, roof frames, and metal fabrication.", {
        businessType: "service",
        customType: "Welding shop",
        section: "Builders & repair",
        keywords: ["welder", "metal", "gate", "grill", "fabrication"],
      }),
      item("carpentry", "Carpentry / furniture", "Woodwork, cabinets, furniture, and home fixtures.", {
        businessType: "service",
        customType: "Carpentry service",
        section: "Builders & repair",
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
        section: "Health",
        keywords: ["doctor", "medical", "checkup", "health", "laboratory"],
      }),
      item("dental", "Dental clinic", "Dental checkups, cleaning, braces, extraction, or dentures.", {
        businessType: "service",
        customType: "Dental clinic",
        section: "Health",
        keywords: ["dentist", "teeth", "braces", "cleaning", "bunot"],
      }),
      item("veterinary", "Veterinary clinic", "Pet care, animal clinic, grooming, or supplies.", {
        businessType: "service",
        customType: "Veterinary clinic",
        section: "Health",
        keywords: ["vet", "pet", "dog", "cat", "animal"],
      }),
      item("salon", "Salon", "Hair, nails, makeup, lashes, or beauty care.", {
        businessType: "salon",
        section: "Beauty",
        keywords: ["beauty", "hair", "nails", "makeup", "parlor"],
      }),
      item("barber", "Barber shop", "Men’s haircut, shave, grooming, or hair styling.", {
        businessType: "salon",
        customType: "Barber shop",
        section: "Beauty",
        keywords: ["haircut", "gupit", "shave", "barbero"],
      }),
      item("massage", "Massage / spa", "Massage, wellness, body care, or spa services.", {
        businessType: "service",
        customType: "Massage spa",
        section: "Wellness",
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
        section: "General services",
        keywords: ["services", "business service", "professional"],
      }),
      item("laundry", "Laundry", "Wash, dry, fold, pressing, or pickup laundry service.", {
        businessType: "laundry",
        section: "Home services",
        keywords: ["wash", "dry", "plantsa", "labada"],
      }),
      item("printing", "Printing / photocopy", "Printing, xerox, lamination, ID photo, or school needs.", {
        businessType: "service",
        customType: "Printing shop",
        section: "Documents & online",
        keywords: ["xerox", "lamination", "photo", "school", "documents"],
      }),
      item("remittance", "Remittance / bills payment", "Padala, bills payment, cash-in, or money services.", {
        businessType: "service",
        customType: "Remittance center",
        section: "Money services",
        keywords: ["gcash", "maya", "palawan", "cebuana", "bills"],
      }),
      item("internet-cafe", "Internet café / computer shop", "Computer rental, gaming, printing, or online services.", {
        businessType: "service",
        customType: "Internet cafe",
        section: "Documents & online",
        keywords: ["computer", "pisonet", "gaming", "online", "typing"],
      }),
      item("tailoring", "Tailoring / dressmaker", "Clothing repair, uniforms, alterations, or sewing.", {
        businessType: "service",
        customType: "Tailoring shop",
        section: "Personal services",
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
        section: "Market stalls",
        keywords: ["palengke", "stall", "market", "vendor"],
      }),
      item("wet-market", "Wet market", "Fresh meat, seafood, vegetables, or public wet market.", {
        businessType: "wet_market",
        section: "Market stalls",
        keywords: ["meat", "fish", "seafood", "vegetables", "palengke"],
      }),
      item("ambulant-vendor", "Ambulant vendor", "Mobile vendor, cart, walking seller, or roaming vendor.", {
        businessType: "ambulant_vendor",
        section: "Mobile vendors",
        keywords: ["mobile", "cart", "street", "roaming", "taho"],
      }),
      item("rice-retailer", "Rice retailer", "Bigas, rice sacks, rice dealer, or grain store.", {
        businessType: "store",
        customType: "Rice retailer",
        section: "Specialty vendors",
        keywords: ["bigas", "rice", "grain", "sack", "palay"],
      }),
      item("meat-shop", "Meat shop", "Fresh meat, frozen meat, poultry, or butcher shop.", {
        businessType: "store",
        customType: "Meat shop",
        section: "Specialty vendors",
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
        section: "Local producers",
        keywords: ["farm", "vegetables", "fruit", "harvest", "palay"],
      }),
      item("fisher", "Fisher / seafood seller", "Fresh fish, seafood, dried fish, or catch-of-the-day.", {
        businessType: "fisher",
        section: "Local producers",
        keywords: ["fish", "seafood", "isda", "tuyo", "catch"],
      }),
      item("livestock", "Livestock", "Poultry, pigs, goats, cattle, eggs, or animal raising.", {
        businessType: "livestock",
        section: "Local producers",
        keywords: ["poultry", "pig", "goat", "cow", "eggs"],
      }),
      item("agri-supply", "Agri supply", "Feeds, fertilizer, seeds, tools, pesticides, and farm inputs.", {
        businessType: "agri_supply",
        section: "Farm supplies",
        keywords: ["feeds", "fertilizer", "seeds", "pesticide", "farm supply"],
      }),
      item("rice-mill", "Rice mill", "Rice milling, palay buying, drying, or grain processing.", {
        businessType: "agri_supply",
        customType: "Rice mill",
        section: "Farm services",
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

export function getBusinessCategoryGroup(categoryId?: string | null) {
  if (!categoryId) return undefined;
  return BUSINESS_CATEGORY_GROUPS.find((group) => group.id === categoryId);
}

export function getBusinessCategoryGroupForFilters(args: {
  types: string[];
  customTypes: string[];
}) {
  const customKeys = new Set(args.customTypes.map((type) => type.toLowerCase()));
  return BUSINESS_CATEGORY_GROUPS.find((group) =>
    group.items.some(
      (item) =>
        (item.businessType && args.types.includes(item.businessType)) ||
        (item.customType && customKeys.has(item.customType.toLowerCase())),
    ),
  );
}

export function getRelatedBusinessCategoryItems(args: {
  categoryId?: string | null;
  types: string[];
  customTypes: string[];
}) {
  const group =
    getBusinessCategoryGroup(args.categoryId) ??
    getBusinessCategoryGroupForFilters({
      types: args.types,
      customTypes: args.customTypes,
    });

  if (!group) return [];

  const customKeys = new Set(args.customTypes.map((type) => type.toLowerCase()));
  const selectedItems = group.items.filter(
    (item) =>
      (item.businessType && args.types.includes(item.businessType)) ||
      (item.customType && customKeys.has(item.customType.toLowerCase())),
  );

  const selectedBroadTypes = new Set(
    selectedItems.map((item) => item.businessType).filter(Boolean),
  );

  const related = selectedBroadTypes.size
    ? group.items.filter(
        (item) =>
          item.businessType &&
          selectedBroadTypes.has(item.businessType) &&
          !selectedItems.some((selected) => selected.id === item.id),
      )
    : group.items.filter(
        (item) => !selectedItems.some((selected) => selected.id === item.id),
      );

  return related.slice(0, 12);
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
        categoryItem.section ?? "",
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