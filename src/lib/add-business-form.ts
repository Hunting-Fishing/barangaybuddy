import { z } from "zod";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";

export type AddBusinessFormState = {
  name: string;
  type: BusinessType;
  additional_types: BusinessType[];
  custom_types: string[];
  tags: string[];
  description: string;
  address: string;
  barangay_search: string;
  barangay_code: string;
  barangay_label: string;
  contact_phone: string;
  contact_email: string;
  website: string;
  hours: string;
  latitude: string;
  longitude: string;
  logo_url: string;
  cover_image_url: string;
};

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !value || /^https?:\/\//i.test(normalizeUrl(value)), {
    message: "Enter a valid URL.",
  });

const coordinate = z
  .string()
  .trim()
  .refine((value) => !value || Number.isFinite(Number(value)), {
    message: "Coordinates must be numbers.",
  });

export const addBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(BUSINESS_TYPES),
  additional_types: z.array(z.enum(BUSINESS_TYPES)).max(10),
  custom_types: z.array(z.string().trim().min(2).max(40)).max(20),
  tags: z.array(z.string().trim().min(1).max(40)).max(50),
  description: z.string().trim().max(2000),
  address: z.string().trim().max(500),
  barangay_code: z.string().min(1, "Choose a barangay."),
  contact_phone: z.string().trim().max(40),
  contact_email: z.union([z.literal(""), z.string().trim().email().max(120)]),
  website: optionalUrl,
  hours: z.string().trim().max(500),
  latitude: coordinate,
  longitude: coordinate,
  logo_url: optionalUrl,
  cover_image_url: optionalUrl,
});

export function createInitialAddBusinessForm(): AddBusinessFormState {
  return {
    name: "",
    type: "store",
    additional_types: [],
    custom_types: [],
    tags: [],
    description: "",
    address: "",
    barangay_search: "",
    barangay_code: "",
    barangay_label: "",
    contact_phone: "",
    contact_email: "",
    website: "",
    hours: "",
    latitude: "",
    longitude: "",
    logo_url: "",
    cover_image_url: "",
  };
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

export function buildBusinessSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `${base || "business"}-${Math.random().toString(36).slice(2, 7)}`;
}
