import { describe, expect, it } from "vitest";
import { canApproveMinorAction, canManageChild, type GuardianRelationship } from "./family";
const relationship = (overrides: Partial<GuardianRelationship> = {}): GuardianRelationship => ({
  id: "r1",
  child_member_id: "child",
  guardian_account_id: "guardian",
  relationship: "parent",
  is_primary: false,
  status: "verified",
  ...overrides,
});
describe("family authorization", () => {
  it("requires an active verified relationship", () => {
    expect(canManageChild([relationship()], "guardian", "child")).toBe(true);
    expect(canManageChild([relationship({ status: "revoked" })], "guardian", "child")).toBe(false);
  });
  it("allows either verified guardian to approve Spotlight", () =>
    expect(canApproveMinorAction([relationship()], "guardian", "child", "spotlight")).toBe(true));
  it("requires the primary guardian for bookings, events and transport", () => {
    expect(canApproveMinorAction([relationship()], "guardian", "child", "booking")).toBe(false);
    expect(
      canApproveMinorAction(
        [relationship({ is_primary: true })],
        "guardian",
        "child",
        "transportation",
      ),
    ).toBe(true);
  });
});
