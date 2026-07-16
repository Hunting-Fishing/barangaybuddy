import type { ComponentType } from "react";
import {
  Briefcase,
  Car,
  Hammer,
  HeartPulse,
  ShoppingBasket,
  Sprout,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import type { BusinessCategoryIcon } from "@/lib/business-category-taxonomy";

export const BUSINESS_CATEGORY_ICONS: Record<
  BusinessCategoryIcon,
  ComponentType<{ className?: string }>
> = {
  food: UtensilsCrossed,
  retail: ShoppingBasket,
  vehicle: Car,
  construction: Hammer,
  health: HeartPulse,
  services: Briefcase,
  market: Store,
  agriculture: Sprout,
};