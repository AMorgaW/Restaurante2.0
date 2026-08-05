import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthForm } from "@/components/auth/auth-form";

const signUp = vi.fn();
const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signUp, signInWithPassword, resetPasswordForEmail, updateUser: vi.fn() },
  }),
}));

describe("formularios de Auth", () => {
  it("mantiene explícito el modo local y no simula una sesión", async () => {
    render(<AuthForm mode="login" enabled={false} />);
    fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(/modo local/i);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("registra solo datos personales y nunca un rol controlable", async () => {
    signUp.mockResolvedValue({ error: null });
    render(<AuthForm mode="register" enabled nextPath="/cuenta" />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "segura123" } });
    fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: "segura123" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrarme" }));
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    const payload = signUp.mock.calls[0]?.[0] as { options: { data: Record<string, unknown> } };
    expect(payload.options.data).toEqual({ name: "Ana" });
    expect(payload.options.data).not.toHaveProperty("role");
  });

  it("solicita recovery a una ruta confiable sin type controlable", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<AuthForm mode="recover" enabled />);
    fireEvent.change(screen.getByLabelText(/Correo electr/i), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar instrucciones" }));
    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalled());
    const options = resetPasswordForEmail.mock.calls.at(-1)?.[1] as { redirectTo: string };
    expect(options.redirectTo).toMatch(/\/actualizar-contrasena$/);
    expect(options.redirectTo).not.toContain("type=");
  });
});
