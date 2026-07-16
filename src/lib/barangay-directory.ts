import { z } from "zod";

export const TAKE_OPTIONS = [25, 50, 75, 100] as const;
export type TakeAmount = (typeof TAKE_OPTIONS)[number];

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.length > 0 ? value : undefined),
  z.string().optional(),
);

const letterSchema = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const upper = value.toUpperCase();
  return /^[A-Z]$/.test(upper) ? upper : undefined;
}, z.string().regex(/^[A-Z]$/).optional());

const takeSchema = z.preprocess((value) => {
  const parsed = Number(value);
  return TAKE_OPTIONS.includes(parsed as TakeAmount) ? parsed : undefined;
}, z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]).optional());

export const barangaySearchSchema = z.object({
  q: optionalString,
  region: optionalString,
  province: optionalString,
  letter: letterSchema,
  take: takeSchema,
});

export type BarangaySearch = z.infer<typeof barangaySearchSchema>;

export type Region = {
  code: string;
  slug: string;
  name: string;
};

export type Province = {
  code: string;
  slug: string;
  name: string;
  region_code: string;
};

export type BrgyResult = {
  code: string;
  slug: string;
  name: string;
  city_code: string;
  city_name: string;
  city_slug: string;
  province_name: string;
  province_slug: string;
  region_name: string;
};

export type BrgyQueryResult = {
  rows: BrgyResult[];
  total: number;
};

export const BARANGAY_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");