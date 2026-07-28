import { describe, expect, it } from "vitest";
import {
  calculateOrderTotals,
  canTransitionDelivery,
  canTransitionOrder,
  driverApplicationSchema,
  orderDraftSchema,
} from "./ecosystem";

describe("Marketplace order state machine", () => {
  it("allows the manual fulfillment happy path", () => {
    expect(canTransitionOrder("submitted", "confirmed")).toBe(true);
    expect(canTransitionOrder("confirmed", "preparing")).toBe(true);
    expect(canTransitionOrder("preparing", "ready")).toBe(true);
    expect(canTransitionOrder("ready", "completed")).toBe(true);
  });
  it("blocks skipping operational states", () =>
    expect(canTransitionOrder("submitted", "completed")).toBe(false));
  it("calculates non-negative totals", () =>
    expect(calculateOrderTotals([{ pricePhp: 100, quantity: 2 }], 40, 10, 25)).toEqual({
      subtotal: 200,
      deliveryFee: 40,
      serviceFee: 10,
      discount: 25,
      total: 225,
    }));
});

describe("Buddy Express delivery state machine", () => {
  it("allows the delivery happy path", () => {
    expect(canTransitionDelivery("offered", "accepted")).toBe(true);
    expect(canTransitionDelivery("accepted", "arrived_pickup")).toBe(true);
    expect(canTransitionDelivery("arrived_pickup", "collected")).toBe(true);
    expect(canTransitionDelivery("collected", "en_route")).toBe(true);
    expect(canTransitionDelivery("en_route", "delivered")).toBe(true);
  });
  it("blocks delivery without collection", () =>
    expect(canTransitionDelivery("accepted", "delivered")).toBe(false));
});

describe("input validation", () => {
  it("requires an address for delivery", () =>
    expect(
      orderDraftSchema.safeParse({
        businessId: crypto.randomUUID(),
        locationId: crypto.randomUUID(),
        fulfillmentMode: "delivery",
        items: [{ catalogItemId: crypto.randomUUID(), quantity: 1 }],
      }).success,
    ).toBe(false));
  it("rejects incomplete driver applications", () =>
    expect(
      driverApplicationSchema.safeParse({
        legalName: "A",
        phone: "1",
        barangayCode: "",
        capacityClass: "small",
      }).success,
    ).toBe(false));
});
