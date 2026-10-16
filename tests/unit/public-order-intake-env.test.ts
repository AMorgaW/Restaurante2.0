import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPublicOrderIntakeEnabled } from "@/lib/env/server";

const configured = {
  DATA_MODE: "supabase",
  NEXT_PUBLIC_SUPABASE_URL: "https://demo-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo_value",
  NEXT_PUBLIC_SITE_URL: "https://demo.example.test",
  PAYMENT_PROVIDER: "demo",
  EMAIL_PROVIDER: "none",
};

describe("compuerta server-only de recepción pública", () => {
  it("permanece cerrada por defecto y no acepta valores parecidos a true", () => {
    expect(isPublicOrderIntakeEnabled(configured)).toBe(false);
    expect(isPublicOrderIntakeEnabled({ ...configured, PUBLIC_ORDER_INTAKE_ENABLED: "TRUE" })).toBe(false);
    expect(isPublicOrderIntakeEnabled({ ...configured, PUBLIC_ORDER_INTAKE_ENABLED: "1" })).toBe(false);
  });

  it("solo se habilita con true literal y Supabase correctamente configurado", () => {
    expect(isPublicOrderIntakeEnabled({ ...configured, PUBLIC_ORDER_INTAKE_ENABLED: "true" })).toBe(true);
    expect(
      isPublicOrderIntakeEnabled({
        ...configured,
        DATA_MODE: "local",
        PUBLIC_ORDER_INTAKE_ENABLED: "true",
      }),
    ).toBe(false);
    expect(
      isPublicOrderIntakeEnabled({
        ...configured,
        PUBLIC_ORDER_INTAKE_ENABLED: "true",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_not_allowed",
      }),
    ).toBe(false);
  });
});
