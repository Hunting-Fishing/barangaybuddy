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
import type { BusinessCategoryIcon as BusinessCategoryIconName } from "@/lib/business-category-taxonomy";

const ICONS: Record<BusinessCategoryIconName, ComponentType<{ className?: string }>> = {
  food: UtensilsCrossed,
  retail: ShoppingBasket,
  vehicle: Car,
  construction: Hammer,
  health: HeartPulse,
  services: Briefcase,
  market: Store,
  agriculture: Sprout,
};

type Props = {
  icon: BusinessCategoryIconName;
  className?: string;
};

export function BusinessCategoryIcon({ icon, className }: Props) {
  const Icon = ICONS[icon];
  return <Icon className={className} />;
}