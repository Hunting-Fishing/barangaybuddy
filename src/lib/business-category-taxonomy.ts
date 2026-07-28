import type { BusinessType } from "@/lib/business-types";

export type BusinessCategoryIcon =
  "food" | "retail" | "vehicle" | "construction" | "health" | "services" | "market" | "agriculture";

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
        "resto-bar",
        "Resto-bar",
        "Restaurant and bar with meals, drinks, pulutan, live music, or nightlife service.",
        {
          businessType: "restaurant",
          customType: "Resto-bar",
          section: foodSection.restaurants,
          keywords: [
            "restobar",
            "resto bar",
            "bar",
            "inuman",
            "pulutan",
            "nightlife",
            "live music",
            "drinks",
          ],
        },
      ),
      item(
        "bar-and-grill",
        "Bar & grill",
        "Grilled food, drinks, pulutan, and casual night dining.",
        {
          businessType: "restaurant",
          customType: "Bar and grill",
          section: foodSection.restaurants,
          keywords: ["bar", "grill", "ihaw", "pulutan", "beer", "inuman", "liempo"],
        },
      ),
      item(
        "buffet-restaurant",
        "Buffet restaurant",
        "Eat-all-you-can, buffet, samgyupsal, hotpot, or unlimited dining.",
        {
          businessType: "restaurant",
          customType: "Buffet restaurant",
          section: foodSection.restaurants,
          keywords: ["buffet", "eat all you can", "unli", "samgyupsal", "hotpot", "unlimited"],
        },
      ),
      item(
        "samgyupsal-korean-grill",
        "Samgyupsal / Korean grill",
        "Korean BBQ, samgyupsal, unlimited pork, beef, side dishes, or grill tables.",
        {
          businessType: "restaurant",
          customType: "Samgyupsal restaurant",
          section: foodSection.restaurants,
          keywords: ["samgyupsal", "korean bbq", "korean grill", "unli", "grill", "lettuce"],
        },
      ),
      item("carinderia", "Carinderia / eatery", "Local cooked food, turo-turo, or lutong bahay.", {
        businessType: "restaurant",
        customType: "Carinderia",
        section: foodSection.restaurants,
        keywords: ["ulam", "lutong bahay", "turo turo", "canteen"],
      }),
      item(
        "lutong-bahay-delivery",
        "Lutong bahay delivery",
        "Home-cooked meals, packed lunch, office meals, or daily ulam delivery.",
        {
          businessType: "food_vendor",
          customType: "Lutong bahay delivery",
          section: foodSection.restaurants,
          keywords: [
            "lutong bahay",
            "packed lunch",
            "ulam",
            "meal delivery",
            "baon",
            "home cooked",
          ],
        },
      ),
      item(
        "silog-tapsihan",
        "Silog / tapsihan",
        "Tapsilog, longsilog, tocilog, breakfast meals, or tapsihan.",
        {
          businessType: "restaurant",
          customType: "Silog restaurant",
          section: foodSection.restaurants,
          keywords: ["tapsilog", "longsilog", "tocilog", "breakfast", "tapsihan"],
        },
      ),
      item(
        "lugawan-gotohan",
        "Lugawan / gotohan",
        "Lugaw, goto, arroz caldo, tokwa’t baboy, or warm rice porridge meals.",
        {
          businessType: "restaurant",
          customType: "Lugawan",
          section: foodSection.restaurants,
          keywords: ["lugaw", "goto", "arroz caldo", "tokwa", "mami", "comfort food"],
        },
      ),
      item(
        "pares-mami-vendor",
        "Pares / mami vendor",
        "Beef pares, mami, goto, lugaw, arroz caldo, or noodle soup stall.",
        {
          businessType: "food_vendor",
          customType: "Pares vendor",
          section: foodSection.restaurants,
          keywords: ["pares", "mami", "goto", "lugaw", "arroz caldo", "noodle soup"],
        },
      ),
      item(
        "pancit-palabok-vendor",
        "Pancit / palabok vendor",
        "Pancit, palabok, bihon, canton, bilao orders, or noodle trays.",
        {
          businessType: "food_vendor",
          customType: "Pancit vendor",
          section: foodSection.restaurants,
          keywords: ["pancit", "palabok", "bihon", "canton", "bilao", "noodles"],
        },
      ),
      item(
        "seafood-paluto",
        "Seafood paluto",
        "Fresh seafood cooked to order, dampa-style meals, sugba, tinola, or kinilaw.",
        {
          businessType: "restaurant",
          customType: "Seafood paluto",
          section: foodSection.restaurants,
          keywords: ["paluto", "seafood", "dampa", "sugba", "kinilaw", "tinola", "fish"],
        },
      ),
      item(
        "ihawan-restaurant",
        "Ihawan restaurant",
        "Grilled meats and seafood, BBQ meals, liempo, chicken inasal, or open-grill dining.",
        {
          businessType: "restaurant",
          customType: "Ihawan restaurant",
          section: foodSection.restaurants,
          keywords: ["ihawan", "grill", "bbq", "inasal", "liempo", "inihaw", "sugba"],
        },
      ),
      item("food-vendor", "Food vendor", "Small food stall, kiosk, or prepared food seller.", {
        businessType: "food_vendor",
        section: foodSection.vendors,
        keywords: ["street food", "stall", "kiosk", "snacks"],
      }),
      item(
        "empanada-vendor",
        "Empanada vendor",
        "Empanada stall, Ilocos empanada, merienda, or fried snack seller.",
        {
          businessType: "food_vendor",
          customType: "Empanada vendor",
          section: foodSection.vendors,
          keywords: ["empanada", "ilocos empanada", "fried snack", "merienda", "stall"],
        },
      ),
      item(
        "sisig-vendor",
        "Sisig vendor",
        "Sisig stall, sizzling sisig, pork sisig, chicken sisig, or pulutan seller.",
        {
          businessType: "food_vendor",
          customType: "Sisig vendor",
          section: foodSection.vendors,
          keywords: ["sisig", "sizzling", "pulutan", "pork sisig", "chicken sisig"],
        },
      ),
      item(
        "ihaw-ihaw-vendor",
        "Ihaw-ihaw / BBQ vendor",
        "Barbecue, isaw, tenga, betamax, grilled liempo, or street grill.",
        {
          businessType: "food_vendor",
          customType: "Ihaw-ihaw vendor",
          section: foodSection.vendors,
          keywords: ["bbq", "barbecue", "isaw", "grill", "ihaw", "liempo", "street food"],
        },
      ),
      item(
        "chicken-inasal-vendor",
        "Chicken inasal seller",
        "Chicken inasal, grilled chicken, pecho, paa, or Bacolod-style meals.",
        {
          businessType: "food_vendor",
          customType: "Chicken inasal seller",
          section: foodSection.vendors,
          keywords: ["chicken inasal", "inasal", "pecho", "paa", "grilled chicken", "bacolod"],
        },
      ),
      item(
        "siomai-vendor",
        "Siomai vendor",
        "Siomai stall, steamed dumplings, chili garlic, or rice meals.",
        {
          businessType: "food_vendor",
          customType: "Siomai vendor",
          section: foodSection.vendors,
          keywords: ["siomai", "dumplings", "chili garlic", "rice meal", "steamed"],
        },
      ),
      item(
        "shawarma-vendor",
        "Shawarma vendor",
        "Shawarma rice, wrap, kebab-style stall, or Middle Eastern snack seller.",
        {
          businessType: "food_vendor",
          customType: "Shawarma vendor",
          section: foodSection.vendors,
          keywords: ["shawarma", "wrap", "shawarma rice", "kebab", "garlic sauce"],
        },
      ),
      item(
        "burger-stand",
        "Burger stand",
        "Burger cart, buy-one-take-one burgers, sandwiches, or quick snacks.",
        {
          businessType: "food_vendor",
          customType: "Burger stand",
          section: foodSection.vendors,
          keywords: ["burger", "sandwich", "buy one take one", "snacks", "stand"],
        },
      ),
      item(
        "kwek-kwek-fishball-vendor",
        "Kwek-kwek / fishball vendor",
        "Kwek-kwek, fishball, kikiam, squid ball, sauces, or tusok-tusok snacks.",
        {
          businessType: "food_vendor",
          customType: "Kwek-kwek vendor",
          section: foodSection.vendors,
          keywords: ["kwek kwek", "fishball", "kikiam", "squid ball", "tusok tusok"],
        },
      ),
      item(
        "lechon-manok-vendor",
        "Lechon manok / liempo",
        "Roasted chicken, liempo, rotisserie, or take-home roasted meat.",
        {
          businessType: "food_vendor",
          customType: "Lechon manok vendor",
          section: foodSection.vendors,
          keywords: ["lechon manok", "liempo", "roasted chicken", "rotisserie", "takeout"],
        },
      ),
      item(
        "lechon-baboy-vendor",
        "Lechon baboy / lechon belly",
        "Whole lechon, lechon belly, party trays, or roasted pork orders.",
        {
          businessType: "food_vendor",
          customType: "Lechon baboy vendor",
          section: foodSection.vendors,
          keywords: ["lechon", "lechon belly", "roasted pork", "party", "whole lechon"],
        },
      ),
      item(
        "chicken-wings-vendor",
        "Chicken wings seller",
        "Flavored wings, fried chicken, boneless chicken, or rice meals.",
        {
          businessType: "food_vendor",
          customType: "Chicken wings seller",
          section: foodSection.vendors,
          keywords: ["wings", "fried chicken", "boneless", "chicken", "rice meal"],
        },
      ),
      item(
        "pizza-vendor",
        "Pizza / pasta seller",
        "Pizza, pasta trays, baked macaroni, lasagna, or party food.",
        {
          businessType: "food_vendor",
          customType: "Pizza seller",
          section: foodSection.vendors,
          keywords: ["pizza", "pasta", "lasagna", "baked macaroni", "party food"],
        },
      ),
      item(
        "meryenda-snack-house",
        "Meryenda / snack house",
        "Local snacks, sandwiches, pancit, turon, drinks, or afternoon food.",
        {
          businessType: "food_vendor",
          customType: "Meryenda snack house",
          section: foodSection.drinksDesserts,
          keywords: ["meryenda", "merienda", "snacks", "pancit", "turon", "banana cue"],
        },
      ),
      item(
        "turon-banana-cue-vendor",
        "Turon / banana cue vendor",
        "Turon, banana cue, camote cue, maruya, or fried saba vendor.",
        {
          businessType: "food_vendor",
          customType: "Turon vendor",
          section: foodSection.drinksDesserts,
          keywords: ["turon", "banana cue", "camote cue", "maruya", "saba", "merienda"],
        },
      ),
      item(
        "kakanin-vendor",
        "Kakanin vendor",
        "Bibingka, puto, kutsinta, sapin-sapin, biko, suman, or native delicacies.",
        {
          businessType: "food_vendor",
          customType: "Kakanin vendor",
          section: foodSection.drinksDesserts,
          keywords: ["kakanin", "puto", "kutsinta", "bibingka", "suman", "biko", "sapin sapin"],
        },
      ),
      item(
        "halo-halo-vendor",
        "Halo-halo / dessert vendor",
        "Halo-halo, mais con hielo, ice scramble, banana split, or cold desserts.",
        {
          businessType: "food_vendor",
          customType: "Halo-halo vendor",
          section: foodSection.drinksDesserts,
          keywords: ["halo halo", "ice scramble", "mais con hielo", "dessert", "cold drinks"],
        },
      ),
      item(
        "dirty-ice-cream-vendor",
        "Sorbetes / dirty ice cream vendor",
        "Sorbetes cart, ice cream sandwich, cone, cup, or street ice cream.",
        {
          businessType: "ambulant_vendor",
          customType: "Sorbetes vendor",
          section: foodSection.drinksDesserts,
          keywords: ["sorbetes", "dirty ice cream", "ice cream", "cart", "cone"],
        },
      ),
      item(
        "fruit-shake-milk-tea",
        "Fruit shake / milk tea stand",
        "Fruit shakes, milk tea, lemonade, gulaman, or cold drinks.",
        {
          businessType: "food_vendor",
          customType: "Drink stand",
          section: foodSection.drinksDesserts,
          keywords: ["fruit shake", "milk tea", "lemonade", "gulaman", "cold drinks"],
        },
      ),
      item(
        "buko-juice-vendor",
        "Buko juice / coconut vendor",
        "Fresh buko, buko juice, coconut shake, or coconut-based drinks.",
        {
          businessType: "food_vendor",
          customType: "Buko juice vendor",
          section: foodSection.drinksDesserts,
          keywords: ["buko", "coconut", "buko juice", "coconut shake", "fresh juice"],
        },
      ),
      item(
        "balut-vendor",
        "Balut / penoy vendor",
        "Balut, penoy, salted egg, or evening street food vendor.",
        {
          businessType: "ambulant_vendor",
          customType: "Balut vendor",
          section: foodSection.mobile,
          keywords: ["balut", "penoy", "salted egg", "street food", "night vendor"],
        },
      ),
      item("taho-vendor", "Taho vendor", "Taho, arnibal, sago, or roaming morning snack vendor.", {
        businessType: "ambulant_vendor",
        customType: "Taho vendor",
        section: foodSection.mobile,
        keywords: ["taho", "arnibal", "sago", "morning", "roaming vendor"],
      }),
      item(
        "ambulant-food-vendor",
        "Roaming food vendor",
        "Mobile food seller, cart vendor, walking vendor, or route-based seller.",
        {
          businessType: "ambulant_vendor",
          customType: "Roaming food vendor",
          section: foodSection.mobile,
          keywords: ["roaming", "walking vendor", "cart", "mobile vendor", "street"],
        },
      ),
      item("bakery", "Bakery", "Bread, pastries, cakes, or panaderya.", {
        businessType: "bakery",
        section: foodSection.bakeryEvents,
        keywords: ["bread", "cake", "pastry", "pan de sal", "panaderya"],
      }),
      item(
        "home-baker",
        "Home baker",
        "Home-based cakes, cupcakes, cookies, brownies, pastries, or dessert trays.",
        {
          businessType: "bakery",
          customType: "Home baker",
          section: foodSection.bakeryEvents,
          keywords: ["home baker", "cake", "cupcakes", "cookies", "brownies", "pastries"],
        },
      ),
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
    id: "entertainment-nightlife",
    label: "Entertainment & nightlife",
    description:
      "Billiards, karaoke, KTV, resto-bars, live music, gaming lounges, event places, and evening hangouts.",
    icon: "services",
    items: [
      item(
        "billiards-hall",
        "Billiards / pool hall",
        "Pool tables, billiards games, tournaments, drinks, or tambayan setup.",
        {
          businessType: "service",
          customType: "Billiards hall",
          section: "Games & hangouts",
          keywords: ["billiards", "pool", "pool hall", "bilyar", "tournament", "tambayan"],
        },
      ),
      item(
        "resto-bar-nightlife",
        "Resto-bar",
        "Food, drinks, pulutan, music, or night hangout service.",
        {
          businessType: "restaurant",
          customType: "Resto-bar",
          section: "Bars & nightlife",
          keywords: [
            "restobar",
            "resto bar",
            "bar",
            "inuman",
            "pulutan",
            "nightlife",
            "live music",
          ],
        },
      ),
      item(
        "karaoke-videoke-bar",
        "Karaoke / videoke bar",
        "Videoke rooms, karaoke, singing, food, drinks, or party packages.",
        {
          businessType: "service",
          customType: "Karaoke bar",
          section: "Music & singing",
          keywords: ["karaoke", "videoke", "ktv", "singing", "music", "party"],
        },
      ),
      item(
        "ktv-lounge",
        "KTV lounge",
        "Private singing rooms, group packages, food, drinks, and celebrations.",
        {
          businessType: "service",
          customType: "KTV lounge",
          section: "Music & singing",
          keywords: ["ktv", "karaoke", "private room", "videoke", "lounge", "party"],
        },
      ),
      item(
        "live-music-bar",
        "Live music bar",
        "Acoustic nights, bands, open mic, performers, drinks, and pulutan.",
        {
          businessType: "restaurant",
          customType: "Live music bar",
          section: "Bars & nightlife",
          keywords: ["live band", "acoustic", "open mic", "music", "bar", "performers"],
        },
      ),
      item(
        "sports-bar",
        "Sports bar",
        "Sports viewing, boxing, basketball, billiards, beer, food, or group watch parties.",
        {
          businessType: "restaurant",
          customType: "Sports bar",
          section: "Bars & nightlife",
          keywords: ["sports bar", "boxing", "basketball", "watch party", "beer", "tv"],
        },
      ),
      item(
        "inuman-tambayan",
        "Inuman tambayan",
        "Casual drinks, pulutan, music, outdoor seating, or neighborhood hangout.",
        {
          businessType: "restaurant",
          customType: "Inuman tambayan",
          section: "Bars & nightlife",
          keywords: ["inuman", "tambayan", "pulutan", "beer", "outdoor", "night"],
        },
      ),
      item(
        "computer-gaming-shop",
        "Computer gaming shop",
        "PC gaming, computer rental, online games, printing, or pisonet-style service.",
        {
          businessType: "service",
          customType: "Computer gaming shop",
          section: "Games & hangouts",
          keywords: ["computer shop", "gaming", "pc", "pisonet", "internet cafe", "online games"],
        },
      ),
      item(
        "arcade-game-room",
        "Arcade / game room",
        "Arcade machines, claw machines, console rental, board games, or family games.",
        {
          businessType: "service",
          customType: "Arcade game room",
          section: "Games & hangouts",
          keywords: ["arcade", "claw machine", "playstation", "console", "board games", "games"],
        },
      ),
      item(
        "event-place",
        "Event place / function hall",
        "Birthdays, debuts, meetings, receptions, small events, or party rentals.",
        {
          businessType: "service",
          customType: "Event place",
          section: "Events",
          keywords: ["event place", "function hall", "venue", "birthday", "debut", "reception"],
        },
      ),
      item(
        "party-karaoke-rental",
        "Party lights / karaoke rental",
        "Karaoke machine, sound system, lights, tables, chairs, or party equipment rental.",
        {
          businessType: "service",
          customType: "Party equipment rental",
          section: "Events",
          keywords: ["karaoke rental", "sounds", "lights", "tables", "chairs", "party rental"],
        },
      ),
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
      item(
        "grocery-mini-mart",
        "Grocery / mini mart",
        "Groceries, frozen goods, household supplies, snacks, drinks, and pantry items.",
        {
          businessType: "store",
          customType: "Grocery store",
          section: "Daily essentials",
          keywords: ["grocery", "mini mart", "frozen goods", "pantry", "household supplies"],
        },
      ),
      item(
        "e-loading-station",
        "E-load / SIM / mobile load",
        "Prepaid load, SIM cards, data promos, e-wallet cash-in, or mobile accessories.",
        {
          businessType: "store",
          customType: "E-loading station",
          section: "Daily essentials",
          keywords: ["eload", "load", "sim", "data promo", "gcash", "maya", "cash in"],
        },
      ),
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
      item(
        "ukay-ukay",
        "Ukay-ukay / thrift shop",
        "Second-hand clothes, shoes, bags, overruns, or affordable fashion.",
        {
          businessType: "dry_goods",
          customType: "Ukay-ukay",
          section: "General merchandise",
          keywords: ["ukay", "thrift", "second hand", "clothes", "overruns", "bags", "shoes"],
        },
      ),
      item(
        "school-supplies-store",
        "School & office supplies",
        "Paper, notebooks, uniforms, printing materials, office supplies, and school needs.",
        {
          businessType: "store",
          customType: "School supplies store",
          section: "General merchandise",
          keywords: ["school supplies", "office supplies", "notebook", "paper", "uniform"],
        },
      ),
      item(
        "cellphone-accessories",
        "Cellphone accessories shop",
        "Chargers, cases, earphones, tempered glass, repairs, or gadgets.",
        {
          businessType: "store",
          customType: "Cellphone accessories shop",
          section: "General merchandise",
          keywords: [
            "cellphone",
            "phone case",
            "charger",
            "earphones",
            "tempered glass",
            "gadgets",
          ],
        },
      ),
      item(
        "water-refilling",
        "Water refilling station",
        "Purified water, mineral water, or delivery.",
        {
          businessType: "store",
          customType: "Water refilling station",
          section: "Home supplies",
          keywords: ["water", "refill", "mineral", "purified", "delivery"],
        },
      ),
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
      item(
        "transport",
        "Transport service",
        "Tricycle, jeepney, shuttle, van, or logistics service.",
        {
          businessType: "transport",
          section: "Transport",
          keywords: ["tricycle", "jeepney", "van", "shuttle", "logistics"],
        },
      ),
      item(
        "tricycle-terminal",
        "Tricycle terminal / TODA",
        "Tricycle queue, TODA service, local rides, or barangay transport pickup point.",
        {
          businessType: "transport",
          customType: "Tricycle terminal",
          section: "Transport",
          keywords: ["tricycle", "toda", "terminal", "local rides", "pila"],
        },
      ),
      item(
        "motorcycle-taxi-rider",
        "Motorcycle taxi / rider service",
        "Habalan, angkas-style rides, pabili, pickup, or local motorcycle transport.",
        {
          businessType: "transport",
          customType: "Motorcycle taxi service",
          section: "Transport",
          keywords: ["habal", "motorcycle taxi", "rider", "pabili", "pickup", "angkas"],
        },
      ),
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
      item(
        "motorcycle-repair",
        "Motorcycle repair shop",
        "Motorcycle maintenance, tune-up, oil change, parts replacement, or roadside repair.",
        {
          businessType: "repair_shop",
          customType: "Motorcycle repair shop",
          section: "Vehicle care",
          keywords: ["motorcycle", "motor", "mechanic", "oil change", "tune up", "parts"],
        },
      ),
      item(
        "vulcanizing",
        "Vulcanizing / tire service",
        "Tire repair, patching, air, or wheel service.",
        {
          businessType: "repair_shop",
          customType: "Vulcanizing shop",
          section: "Vehicle care",
          keywords: ["tire", "gulong", "hangin", "patch", "flat tire"],
        },
      ),
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
      item(
        "vehicle-parts",
        "Vehicle parts & accessories",
        "Motorcycle, car, bike parts, oil, and accessories.",
        {
          businessType: "store",
          customType: "Vehicle parts store",
          section: "Vehicle supplies",
          keywords: ["parts", "accessories", "motorcycle parts", "auto supply", "oil"],
        },
      ),
    ],
  },
  {
    id: "construction-home",
    label: "Construction & home",
    description:
      "Hardware, contractors, plumbers, electricians, welding, carpentry, and home services.",
    icon: "construction",
    items: [
      item(
        "hardware",
        "Hardware",
        "Construction supplies, tools, paint, plumbing, and electrical goods.",
        {
          businessType: "hardware",
          section: "Supplies",
          keywords: ["tools", "cement", "paint", "plywood", "construction supplies"],
        },
      ),
      item(
        "construction-supply",
        "Construction supply",
        "Cement, hollow blocks, sand, gravel, steel bars, lumber, and building materials.",
        {
          businessType: "hardware",
          customType: "Construction supply",
          section: "Supplies",
          keywords: ["cement", "hollow blocks", "sand", "gravel", "steel", "lumber"],
        },
      ),
      item(
        "hollow-blocks-maker",
        "Hollow blocks maker",
        "CHB, concrete products, paving blocks, or local construction materials.",
        {
          businessType: "hardware",
          customType: "Hollow blocks maker",
          section: "Supplies",
          keywords: ["hollow blocks", "chb", "concrete", "paving blocks", "construction"],
        },
      ),
      item(
        "construction-contractor",
        "Construction contractor",
        "House building, renovation, or project contractor.",
        {
          businessType: "service",
          customType: "Construction contractor",
          section: "Builders & repair",
          keywords: ["builder", "renovation", "house", "contractor", "mason"],
        },
      ),
      item("plumber", "Plumbing service", "Pipe repair, water line, drainage, and fixture work.", {
        businessType: "service",
        customType: "Plumbing service",
        section: "Builders & repair",
        keywords: ["tubero", "pipe", "drainage", "faucet", "water line"],
      }),
      item(
        "electrician",
        "Electrical service",
        "Wiring, repair, lighting, breakers, and electrical installation.",
        {
          businessType: "service",
          customType: "Electrical service",
          section: "Builders & repair",
          keywords: ["electrician", "wiring", "breaker", "lighting", "installation"],
        },
      ),
      item(
        "welding",
        "Welding / metal works",
        "Gates, grills, roof frames, and metal fabrication.",
        {
          businessType: "service",
          customType: "Welding shop",
          section: "Builders & repair",
          keywords: ["welder", "metal", "gate", "grill", "fabrication"],
        },
      ),
      item(
        "carpentry",
        "Carpentry / furniture",
        "Woodwork, cabinets, furniture, and home fixtures.",
        {
          businessType: "service",
          customType: "Carpentry service",
          section: "Builders & repair",
          keywords: ["wood", "cabinet", "furniture", "door", "table"],
        },
      ),
      item(
        "roofing-service",
        "Roofing / gutter service",
        "Roof repair, gutters, downspouts, metal roofing, or leak fixes.",
        {
          businessType: "service",
          customType: "Roofing service",
          section: "Builders & repair",
          keywords: ["roof", "yero", "gutter", "leak", "downspout", "roofing"],
        },
      ),
    ],
  },
  {
    id: "health-beauty",
    label: "Health, beauty & wellness",
    description: "Clinics, dental care, pharmacies, salons, barbers, massage, and personal care.",
    icon: "health",
    items: [
      item(
        "clinic",
        "Clinic",
        "Medical consultation, checkups, or barangay-level health service.",
        {
          businessType: "service",
          customType: "Clinic",
          section: "Health",
          keywords: ["doctor", "medical", "checkup", "health", "laboratory"],
        },
      ),
      item(
        "diagnostic-lab",
        "Diagnostic / laboratory clinic",
        "Blood tests, urinalysis, x-ray, ultrasound, ECG, or medical diagnostics.",
        {
          businessType: "service",
          customType: "Diagnostic clinic",
          section: "Health",
          keywords: ["laboratory", "diagnostic", "blood test", "xray", "ultrasound", "ecg"],
        },
      ),
      item(
        "dental",
        "Dental clinic",
        "Dental checkups, cleaning, braces, extraction, or dentures.",
        {
          businessType: "service",
          customType: "Dental clinic",
          section: "Health",
          keywords: ["dentist", "teeth", "braces", "cleaning", "bunot"],
        },
      ),
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
      item(
        "nail-lash-studio",
        "Nail / lash studio",
        "Manicure, pedicure, gel nails, eyelash extensions, brows, or beauty services.",
        {
          businessType: "salon",
          customType: "Nail and lash studio",
          section: "Beauty",
          keywords: ["nails", "lashes", "eyelash", "manicure", "pedicure", "brows"],
        },
      ),
      item("massage", "Massage / spa", "Massage, wellness, body care, or spa services.", {
        businessType: "service",
        customType: "Massage spa",
        section: "Wellness",
        keywords: ["hilot", "spa", "wellness", "body massage"],
      }),
      item(
        "traditional-hilot",
        "Traditional hilot",
        "Hilot, wellness massage, home service bodywork, or traditional therapy.",
        {
          businessType: "service",
          customType: "Traditional hilot",
          section: "Wellness",
          keywords: ["hilot", "traditional", "massage", "home service", "wellness"],
        },
      ),
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
      item(
        "cleaning-service",
        "House cleaning service",
        "Home cleaning, deep cleaning, move-out cleaning, or helper services.",
        {
          businessType: "service",
          customType: "House cleaning service",
          section: "Home services",
          keywords: ["cleaning", "linis", "home service", "deep clean", "helper"],
        },
      ),
      item(
        "printing",
        "Printing / photocopy",
        "Printing, xerox, lamination, ID photo, or school needs.",
        {
          businessType: "service",
          customType: "Printing shop",
          section: "Documents & online",
          keywords: ["xerox", "lamination", "photo", "school", "documents"],
        },
      ),
      item(
        "tarpaulin-printing",
        "Tarpaulin / signage printing",
        "Tarpaulins, stickers, signages, invitations, layouts, and large-format printing.",
        {
          businessType: "service",
          customType: "Tarpaulin printing",
          section: "Documents & online",
          keywords: ["tarpaulin", "tarp", "signage", "stickers", "layout", "printing"],
        },
      ),
      item(
        "remittance",
        "Remittance / bills payment",
        "Padala, bills payment, cash-in, or money services.",
        {
          businessType: "service",
          customType: "Remittance center",
          section: "Money services",
          keywords: ["gcash", "maya", "palawan", "cebuana", "bills"],
        },
      ),
      item(
        "pawnshop",
        "Pawnshop",
        "Sangla, jewelry pawn, remittance, bills payment, or money services.",
        {
          businessType: "service",
          customType: "Pawnshop",
          section: "Money services",
          keywords: ["pawnshop", "sangla", "jewelry", "remittance", "pera"],
        },
      ),
      item(
        "internet-cafe",
        "Internet café / computer shop",
        "Computer rental, gaming, printing, or online services.",
        {
          businessType: "service",
          customType: "Internet cafe",
          section: "Documents & online",
          keywords: ["computer", "pisonet", "gaming", "online", "typing"],
        },
      ),
      item(
        "cellphone-repair",
        "Cellphone repair",
        "Phone repair, screen replacement, battery replacement, charging port, or gadget repair.",
        {
          businessType: "repair_shop",
          customType: "Cellphone repair shop",
          section: "Repair services",
          keywords: ["cellphone repair", "phone repair", "screen", "battery", "charging port"],
        },
      ),
      item(
        "appliance-repair",
        "Appliance repair",
        "Electric fan, TV, washing machine, refrigerator, aircon, or small appliance repair.",
        {
          businessType: "repair_shop",
          customType: "Appliance repair service",
          section: "Repair services",
          keywords: ["appliance", "electric fan", "tv", "washing machine", "ref", "aircon"],
        },
      ),
      item(
        "tailoring",
        "Tailoring / dressmaker",
        "Clothing repair, uniforms, alterations, or sewing.",
        {
          businessType: "service",
          customType: "Tailoring shop",
          section: "Personal services",
          keywords: ["sewing", "alteration", "uniform", "dressmaker", "mananahi"],
        },
      ),
      item(
        "event-stylist",
        "Event stylist / party decorator",
        "Balloon decor, backdrops, party styling, flowers, and event setup.",
        {
          businessType: "service",
          customType: "Event stylist",
          section: "Events",
          keywords: ["event stylist", "party decorator", "balloons", "backdrop", "flowers"],
        },
      ),
      item(
        "photo-video-service",
        "Photo / video service",
        "Photography, videography, photo booth, event coverage, or editing.",
        {
          businessType: "service",
          customType: "Photo and video service",
          section: "Events",
          keywords: ["photography", "videography", "photo booth", "event coverage", "editing"],
        },
      ),
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
      item(
        "talipapa",
        "Talipapa / mini market",
        "Small neighborhood market for fish, meat, vegetables, fruits, or daily food needs.",
        {
          businessType: "wet_market",
          customType: "Talipapa",
          section: "Market stalls",
          keywords: ["talipapa", "mini market", "fish", "meat", "vegetables", "palengke"],
        },
      ),
      item(
        "ambulant-vendor",
        "Ambulant vendor",
        "Mobile vendor, cart, walking seller, or roaming vendor.",
        {
          businessType: "ambulant_vendor",
          section: "Mobile vendors",
          keywords: ["mobile", "cart", "street", "roaming", "taho"],
        },
      ),
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
      item(
        "fish-stall",
        "Fish stall",
        "Fresh fish, seafood, shellfish, dried fish, or seafood market seller.",
        {
          businessType: "market_vendor",
          customType: "Fish stall",
          section: "Specialty vendors",
          keywords: ["fish", "isda", "seafood", "shellfish", "tuyo", "palengke"],
        },
      ),
      item(
        "fruit-vegetable-stand",
        "Fruit / vegetable stand",
        "Fresh fruits, vegetables, herbs, crops, and local produce.",
        {
          businessType: "market_vendor",
          customType: "Fruit and vegetable stand",
          section: "Specialty vendors",
          keywords: ["fruit", "vegetables", "gulay", "prutas", "produce", "market"],
        },
      ),
      item(
        "egg-poultry-vendor",
        "Egg / poultry vendor",
        "Eggs, dressed chicken, poultry products, or frozen poultry.",
        {
          businessType: "market_vendor",
          customType: "Egg and poultry vendor",
          section: "Specialty vendors",
          keywords: ["egg", "itlog", "poultry", "chicken", "dressed chicken"],
        },
      ),
    ],
  },
  {
    id: "agriculture-fisheries",
    label: "Agriculture & fisheries",
    description: "Farmers, fishers, livestock, agri-supply, feeds, seedlings, and local producers.",
    icon: "agriculture",
    items: [
      item(
        "farmer",
        "Farmer / produce seller",
        "Farm produce, crops, fruits, vegetables, or local harvest.",
        {
          businessType: "farmer",
          section: "Local producers",
          keywords: ["farm", "vegetables", "fruit", "harvest", "palay"],
        },
      ),
      item(
        "fisher",
        "Fisher / seafood seller",
        "Fresh fish, seafood, dried fish, or catch-of-the-day.",
        {
          businessType: "fisher",
          section: "Local producers",
          keywords: ["fish", "seafood", "isda", "tuyo", "catch"],
        },
      ),
      item("livestock", "Livestock", "Poultry, pigs, goats, cattle, eggs, or animal raising.", {
        businessType: "livestock",
        section: "Local producers",
        keywords: ["poultry", "pig", "goat", "cow", "eggs"],
      }),
      item(
        "agri-supply",
        "Agri supply",
        "Feeds, fertilizer, seeds, tools, pesticides, and farm inputs.",
        {
          businessType: "agri_supply",
          section: "Farm supplies",
          keywords: ["feeds", "fertilizer", "seeds", "pesticide", "farm supply"],
        },
      ),
      item(
        "feeds-supply",
        "Feeds supply",
        "Animal feeds, vitamins, poultry supplies, hog feeds, and livestock needs.",
        {
          businessType: "agri_supply",
          customType: "Feeds supply",
          section: "Farm supplies",
          keywords: ["feeds", "hog feeds", "poultry feeds", "vitamins", "livestock"],
        },
      ),
      item(
        "seedling-plant-nursery",
        "Seedling / plant nursery",
        "Seedlings, ornamental plants, fruit trees, garden soil, and planting supplies.",
        {
          businessType: "agri_supply",
          customType: "Plant nursery",
          section: "Farm supplies",
          keywords: ["seedlings", "plants", "nursery", "ornamental", "fruit trees", "garden"],
        },
      ),
      item("rice-mill", "Rice mill", "Rice milling, palay buying, drying, or grain processing.", {
        businessType: "agri_supply",
        customType: "Rice mill",
        section: "Farm services",
        keywords: ["palay", "milling", "grain", "drying", "bigasan"],
      }),
      item(
        "fishpond-aquaculture",
        "Fishpond / aquaculture",
        "Tilapia, bangus, hito, shrimp farming, fishpond harvests, or aquaculture supplies.",
        {
          businessType: "fisher",
          customType: "Fishpond",
          section: "Farm services",
          keywords: ["fishpond", "aquaculture", "tilapia", "bangus", "hito", "shrimp"],
        },
      ),
    ],
  },
  {
    id: "travel-stay-venues",
    label: "Travel, stay & venues",
    description:
      "Resorts, transient rooms, private pools, event venues, tour guides, cottages, and local attractions.",
    icon: "services",
    items: [
      item(
        "resort",
        "Resort",
        "Pool resort, beach resort, family resort, cottages, day tour, or overnight stay.",
        {
          businessType: "service",
          customType: "Resort",
          section: "Stay & leisure",
          keywords: ["resort", "pool", "beach", "cottages", "day tour", "overnight"],
        },
      ),
      item(
        "private-pool",
        "Private pool",
        "Private swimming pool rental, barkada outing, family events, or day-use pool.",
        {
          businessType: "service",
          customType: "Private pool",
          section: "Stay & leisure",
          keywords: ["private pool", "swimming", "pool rental", "outing", "day use"],
        },
      ),
      item(
        "transient-house",
        "Transient house / room",
        "Short-term stay, transient room, apartment, boarding, or local accommodation.",
        {
          businessType: "service",
          customType: "Transient house",
          section: "Stay & lodging",
          keywords: ["transient", "room", "short stay", "boarding", "accommodation", "apartment"],
        },
      ),
      item(
        "homestay",
        "Homestay",
        "Local home stay, guest room, family lodging, or budget accommodation.",
        {
          businessType: "service",
          customType: "Homestay",
          section: "Stay & lodging",
          keywords: ["homestay", "guest room", "lodging", "budget stay", "tourist"],
        },
      ),
      item(
        "event-venue",
        "Event venue",
        "Wedding, birthday, seminar, reception, party, or function venue.",
        {
          businessType: "service",
          customType: "Event venue",
          section: "Events",
          keywords: ["event venue", "wedding", "birthday", "seminar", "reception", "function"],
        },
      ),
      item(
        "tour-guide",
        "Tour guide / local guide",
        "Local tours, island hopping, hiking guide, heritage walks, or travel assistance.",
        {
          businessType: "service",
          customType: "Tour guide",
          section: "Tours",
          keywords: ["tour guide", "local guide", "island hopping", "hiking", "travel", "tour"],
        },
      ),
      item(
        "boat-rental",
        "Boat rental",
        "Island hopping, banca rental, fishing trips, river tours, or coastal transport.",
        {
          businessType: "transport",
          customType: "Boat rental",
          section: "Tours",
          keywords: ["boat", "banca", "island hopping", "fishing trip", "river tour"],
        },
      ),
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
    : group.items.filter((item) => !selectedItems.some((selected) => selected.id === item.id));

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
    .filter(
      (result): result is BusinessCategoryItem & { groupLabel: string; score: number } =>
        result !== null,
    )
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .slice(0, 8);
}
