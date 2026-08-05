import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getAuthModeStatus: () => ({ mode: "supabase", configured: true, missing: [], invalid: [] }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth }),
}));

import { POST } from "@/app/auth/update-password/route";

const user = { id: "user-1" };

function request(body: unknown) {
  return new Request("http://localhost/auth/update-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("recovery de un solo uso", () => {
  beforeEach(() => {
    auth.verifyOtp.mockReset();
    auth.getUser.mockReset();
    auth.updateUser.mockReset();
    auth.signOut.mockReset();
    auth.verifyOtp.mockResolvedValue({ data: { user }, error: null });
    auth.getUser.mockResolvedValue({ data: { user }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it("fija recovery en servidor, valida identidad, actualiza y limpia la sesion temporal", async () => {
    const response = await POST(request({ tokenHash: "valid-token", password: "segura-123" }));
    expect(response.status).toBe(200);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "valid-token", type: "recovery" });
    expect(auth.getUser).toHaveBeenCalledTimes(1);
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "segura-123" });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
  });

  it.each([
    [{ password: "segura-123" }, 403],
    [{ tokenHash: "valid-token", password: "short" }, 422],
  ])("rechaza body invalido %#", async (body, expectedStatus) => {
    const response = await POST(request(body));
    expect(response.status).toBe(expectedStatus);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it.each(["manipulated", "expired", "already-used"])("rechaza token %s antes de actualizar", async (tokenHash) => {
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid otp") });
    const response = await POST(request({ tokenHash, password: "segura-123" }));
    expect(response.status).toBe(403);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("rechaza una sesion ordinaria si el token recovery no verifica", async () => {
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid otp") });
    auth.getUser.mockResolvedValueOnce({ data: { user }, error: null });
    const response = await POST(request({ tokenHash: "not-recovery", password: "segura-123" }));
    expect(response.status).toBe(403);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("limpia la sesion temporal aunque falle updateUser", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: new Error("update failed") });
    const response = await POST(request({ tokenHash: "valid-token", password: "segura-123" }));
    expect(response.status).toBe(400);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("solo permite una de dos solicitudes concurrentes con el mismo token", async () => {
    let consumed = false;
    auth.verifyOtp.mockImplementation(async () => {
      await Promise.resolve();
      if (consumed) return { data: { user: null }, error: new Error("already used") };
      consumed = true;
      return { data: { user }, error: null };
    });
    const responses = await Promise.all([
      POST(request({ tokenHash: "single-use", password: "segura-123" })),
      POST(request({ tokenHash: "single-use", password: "segura-123" })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 403]);
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
  });
});
