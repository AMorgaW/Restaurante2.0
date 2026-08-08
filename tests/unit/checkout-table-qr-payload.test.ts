import { describe, expect, it } from "vitest";
import { checkoutInputSchema } from "@/features/checkout/schema";

const base = {
  idempotencyKey: "3b241101-e2bb-4255-8caf-4136c566a962",
  branchId: "branch-centro",
  customer: { name: "Ana Pérez", phone: "+57 300 123 4567", email: "ana@example.com" },
  items: [{ slug: "carne-asada", quantity: 1, notes: "", modifiers: [] }],
  tipPercent: 0,
  notes: "",
};

describe("checkoutInputSchema tableQrToken", () => {
  it("exige tableQrToken cuando fulfillment es local", () => {
    const result = checkoutInputSchema.safeParse({
      ...base,
      fulfillmentType: "local",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("tableQrToken"))).toBe(true);
    }
  });

  it("rechaza tableQrToken en pickup", () => {
    const result = checkoutInputSchema.safeParse({
      ...base,
      fulfillmentType: "pickup",
      tableQrToken: "abcdef0123456789abcdef0123456789",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("tableQrToken"))).toBe(true);
    }
  });

  it("acepta local con token válido", () => {
    const result = checkoutInputSchema.safeParse({
      ...base,
      fulfillmentType: "local",
      tableQrToken: "abcdef0123456789abcdef0123456789",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tableQrToken).toBe("abcdef0123456789abcdef0123456789");
      expect(result.data.fulfillmentType).toBe("local");
    }
  });
});
