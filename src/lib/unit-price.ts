// Pure helpers for normalizing pack pricing into per-each and per-unit values
// so shoppers can fairly compare the same product across sellers.

export type SizeUnit = "g" | "kg" | "ml" | "L" | "pc";

export const SIZE_UNITS: SizeUnit[] = ["g", "kg", "ml", "L", "pc"];

export interface UnitPrice {
  perEach: number | null;
  perUnit: number | null;
  baseUnit: "kg" | "L" | "pc" | null;
}

export function computeUnitPrice(
  price: number | null | undefined,
  packQty: number | null | undefined,
  sizeValue: number | null | undefined,
  sizeUnit: SizeUnit | string | null | undefined,
): UnitPrice {
  if (price == null || !isFinite(price) || price < 0) {
    return { perEach: null, perUnit: null, baseUnit: null };
  }
  const qty = packQty && packQty > 0 ? packQty : 1;
  const perEach = price / qty;

  if (!sizeValue || sizeValue <= 0 || !sizeUnit) {
    return { perEach, perUnit: null, baseUnit: null };
  }

  // total size of the whole pack in the base unit
  let totalBase = 0;
  let baseUnit: "kg" | "L" | "pc" = "pc";
  switch (sizeUnit) {
    case "g":
      totalBase = (sizeValue * qty) / 1000;
      baseUnit = "kg";
      break;
    case "kg":
      totalBase = sizeValue * qty;
      baseUnit = "kg";
      break;
    case "ml":
      totalBase = (sizeValue * qty) / 1000;
      baseUnit = "L";
      break;
    case "L":
      totalBase = sizeValue * qty;
      baseUnit = "L";
      break;
    case "pc":
      totalBase = sizeValue * qty;
      baseUnit = "pc";
      break;
    default:
      return { perEach, perUnit: null, baseUnit: null };
  }
  if (totalBase <= 0) return { perEach, perUnit: null, baseUnit: null };
  return { perEach, perUnit: price / totalBase, baseUnit };
}

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function formatPerEach(perEach: number | null) {
  return perEach == null ? null : `${peso(perEach)} / ea`;
}

export function formatPerUnit(perUnit: number | null, baseUnit: UnitPrice["baseUnit"]) {
  if (perUnit == null || !baseUnit) return null;
  return `${peso(perUnit)} / ${baseUnit}`;
}

export function formatPrice(price: number | null | undefined) {
  if (price == null) return "—";
  return peso(price);
}
