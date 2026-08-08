import foodDrinks from "@/assets/categories/food-drinks.webp.asset.json";
import entertainmentNightlife from "@/assets/categories/entertainment-nightlife.webp.asset.json";
import retailEssentials from "@/assets/categories/retail-essentials.webp.asset.json";
import vehicleTransport from "@/assets/categories/vehicle-transport.webp.asset.json";
import constructionHome from "@/assets/categories/construction-home.webp.asset.json";
import healthBeauty from "@/assets/categories/health-beauty.webp.asset.json";
import localServices from "@/assets/categories/local-services.webp.asset.json";
import marketsVendors from "@/assets/categories/markets-vendors.webp.asset.json";
import agricultureFisheries from "@/assets/categories/agriculture-fisheries.webp.asset.json";
import travelStayVenues from "@/assets/categories/travel-stay-venues.webp.asset.json";

export const CATEGORY_IMAGES: Record<string, string> = {
  "food-drinks": foodDrinks.url,
  "entertainment-nightlife": entertainmentNightlife.url,
  "retail-essentials": retailEssentials.url,
  "vehicle-transport": vehicleTransport.url,
  "construction-home": constructionHome.url,
  "health-beauty": healthBeauty.url,
  "local-services": localServices.url,
  "markets-vendors": marketsVendors.url,
  "agriculture-fisheries": agricultureFisheries.url,
  "travel-stay-venues": travelStayVenues.url,
};
