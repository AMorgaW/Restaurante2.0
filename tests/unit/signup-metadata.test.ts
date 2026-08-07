import { describe, expect, it } from "vitest";
import {
  buildPublicSignupMetadata,
  signupPayloadAttemptsPrivilegeEscalation,
} from "@/lib/auth/signup-metadata";

describe("metadata de registro público", () => {
  it("solo conserva nombre y teléfono sanitizados", () => {
    expect(buildPublicSignupMetadata({
      name: "  Ana  Pérez  ",
      phone: "+57 (300) 123-4567",
      role: "owner",
      staff_status: "active",
      branchIds: ["x"],
    })).toEqual({
      name: "Ana Pérez",
      phone: "+57 (300) 123-4567",
    });
  });

  it("omite campos vacíos y nunca incluye rol", () => {
    expect(buildPublicSignupMetadata({ name: "   ", role: "admin" })).toEqual({});
    expect(buildPublicSignupMetadata({ name: "Cliente" })).toEqual({ name: "Cliente" });
  });

  it("detecta intentos de escalada por claves privilegiadas", () => {
    expect(signupPayloadAttemptsPrivilegeEscalation({ role: "owner" })).toBe(true);
    expect(signupPayloadAttemptsPrivilegeEscalation({ staff_status: "active" })).toBe(true);
    expect(signupPayloadAttemptsPrivilegeEscalation({ name: "Ana" })).toBe(false);
  });
});
