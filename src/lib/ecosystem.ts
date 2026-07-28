import { z } from "zod";

export const ORDER_STATUSES = [
  "submitted",
  "confirmed",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "delivered",
  "completed",
  "rejected",
  "cancelled",
  "refunded",
] as const;
export type MarketplaceOrderStatus = (typeof ORDER_STATUSES)[number];
export const DELIVERY_STATUSES = [
  "offered",
  "accepted",
  "arrived_pickup",
  "collected",
  "en_route",
  "delivered",
  "failed",
  "returned",
  "cancelled",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const orderTransitions: Record<MarketplaceOrderStatus, MarketplaceOrderStatus[]> = {
  submitted: ["confirmed", "rejected", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["assigned", "completed", "cancelled"],
  assigned: ["picked_up", "cancelled"],
  picked_up: ["delivered", "cancelled"],
  delivered: ["completed"],
  completed: ["refunded"],
  rejected: [],
  cancelled: [],
  refunded: [],
};
export const deliveryTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  offered: ["accepted", "cancelled"],
  accepted: ["arrived_pickup", "cancelled"],
  arrived_pickup: ["collected", "failed"],
  collected: ["en_route", "returned"],
  en_route: ["delivered", "failed", "returned"],
  failed: ["returned", "cancelled"],
  delivered: [],
  returned: [],
  cancelled: [],
};

export const merchantLocationSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(500),
  barangayCode: z.string().trim().min(1),
  minimumOrderPhp: z.number().min(0).max(1_000_000),
  prepMinutes: z.number().int().min(0).max(1440),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  reservationsEnabled: z.boolean(),
});
export const catalogItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  pricePhp: z.number().min(0).max(10_000_000),
  stockQuantity: z.number().int().min(0).nullable(),
  active: z.boolean(),
});
export const orderDraftSchema = z
  .object({
    businessId: z.string().uuid(),
    locationId: z.string().uuid(),
    fulfillmentMode: z.enum(["pickup", "delivery"]),
    deliveryAddress: z.string().trim().max(500).optional(),
    items: z
      .array(
        z.object({
          catalogItemId: z.string().uuid(),
          quantity: z.number().int().min(1).max(100),
          modifierOptionIds: z.array(z.string().uuid()).max(20).default([]),
        }),
      )
      .min(1),
  })
  .refine((v) => v.fulfillmentMode !== "delivery" || !!v.deliveryAddress, {
    message: "Delivery address is required.",
  });
export const driverApplicationSchema = z.object({
  legalName: z.string().trim().min(3).max(150),
  phone: z.string().trim().min(7).max(30),
  barangayCode: z.string().min(1),
  capacityClass: z.enum(["small", "medium", "large", "passenger"]),
});
export const substitutionProposalSchema = z.object({
  orderItemId: z.string().uuid(),
  replacementName: z.string().trim().min(2).max(120),
  replacementPricePhp: z.number().min(0).max(10_000_000),
});
export const reservationRequestSchema = z.object({
  locationId: z.string().uuid(),
  partySize: z.number().int().min(1).max(100),
  reservedFor: z.string().datetime(),
  contactName: z.string().trim().min(2).max(150),
  contactPhone: z.string().trim().min(7).max(30),
  notes: z.string().trim().max(1000).optional(),
});
export const supportCaseSchema = z.object({
  orderId: z.string().uuid().optional(),
  deliveryJobId: z.string().uuid().optional(),
  category: z.string().trim().min(2).max(80),
  message: z.string().trim().min(10).max(2000),
});

export function canTransitionOrder(from: MarketplaceOrderStatus, to: MarketplaceOrderStatus) {
  return orderTransitions[from].includes(to);
}
export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus) {
  return deliveryTransitions[from].includes(to);
}
export function calculateOrderTotals(
  lines: Array<{ pricePhp: number; quantity: number }>,
  deliveryFee = 0,
  serviceFee = 0,
  discount = 0,
) {
  const subtotal = lines.reduce((sum, line) => sum + line.pricePhp * line.quantity, 0);
  return {
    subtotal,
    deliveryFee,
    serviceFee,
    discount,
    total: Math.max(0, subtotal + deliveryFee + serviceFee - discount),
  };
}
