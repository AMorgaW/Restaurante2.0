"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirect";
import { siteUrl } from "@/lib/env/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PENSION_DEMO_PROFILES } from "@/lib/pension/fixtures";
import { useAdminStore } from "@/stores/admin";
import { resetPensionDemo, usePensionStore } from "@/stores/pension";
import { resetStaffDemo, useStaffStore } from "@/stores/staff";

type AuthFormMode = "login" | "register" | "recover" | "update";

const copy: Record<AuthFormMode, { title: string; submit: string; alternate: string; href: string }> = {
  login: { title: "Iniciar sesi\u00f3n", submit: "Entrar", alternate: "Crear una cuenta", href: "/registro" },
  register: { title: "Crear cuenta", submit: "Registrarme", alternate: "Ya tengo cuenta", href: "/login" },
  recover: { title: "Recuperar contrase\u00f1a", submit: "Enviar instrucciones", alternate: "Volver a iniciar sesi\u00f3n", href: "/login" },
  update: { title: "Actualizar contrase\u00f1a", submit: "Guardar contrase\u00f1a", alternate: "Volver a iniciar sesi\u00f3n", href: "/login" },
};

export function AuthForm({
  mode,
  enabled,
  nextPath = "/cuenta",
  tokenHash,
  unavailableMessage,
}: {
  mode: AuthFormMode;
  enabled: boolean;
  nextPath?: string;
  tokenHash?: string;
  unavailableMessage?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loginDemo = useAdminStore((state) => state.loginDemo);
  const setDemoProfile = usePensionStore((state) => state.setDemoProfile);
  const setSelectedEmployee = useStaffStore((state) => state.setSelectedEmployee);
  const current = copy[mode];

  useEffect(() => {
    if (mode === "update" && tokenHash && window.location.search) {
      window.history.replaceState(window.history.state, "", "/actualizar-contrasena");
    }
  }, [mode, tokenHash]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!enabled) {
      setError(unavailableMessage ?? "El modo local no mantiene sesiones; puedes continuar como invitado.");
      return;
    }
    if ((mode === "login" || mode === "register" || mode === "recover") && !email) {
      setError("Escribe un correo v\u00e1lido.");
      return;
    }
    if ((mode === "login" || mode === "register" || mode === "update") && password.length < 8) {
      setError("La contrase\u00f1a debe tener al menos 8 caracteres.");
      return;
    }
    if ((mode === "register" || mode === "update") && password !== confirmation) {
      setError("Las contrase\u00f1as no coinciden.");
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const resolution = await fetch("/auth/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ next: safeNextPath(nextPath) }),
        });
        const resolved = await resolution.json() as { destination?: string };
        if (!resolution.ok || !resolved.destination) throw new Error("session-resolution-failed");
        router.replace(resolved.destination);
        router.refresh();
      } else if (mode === "register") {
        const { data: signUpData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNextPath(nextPath))}`,
          },
        });
        if (authError) throw authError;
        if (signUpData.session) {
          const resolution = await fetch("/auth/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ next: safeNextPath(nextPath) }),
          });
          const resolved = await resolution.json() as { destination?: string };
          if (!resolution.ok || !resolved.destination) throw new Error("session-resolution-failed");
          router.replace(resolved.destination);
          router.refresh();
        } else {
          setMessage("Si el correo es válido, recibirás instrucciones para confirmar tu cuenta.");
        }
      } else if (mode === "recover") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/actualizar-contrasena`,
        });
        if (authError) throw authError;
        setMessage("Si el correo es v\u00e1lido, recibir\u00e1s instrucciones para recuperar tu contrase\u00f1a.");
      } else {
        if (!tokenHash) throw new Error("missing-recovery-token");
        const response = await fetch("/auth/update-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, tokenHash }),
        });
        if (!response.ok) throw new Error("password-update-failed");
        setPassword("");
        setConfirmation("");
        router.replace("/login?message=password-updated");
        router.refresh();
      }
    } catch {
      setError("No pudimos completar la operaci\u00f3n. Revisa los datos e int\u00e9ntalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const disabledCopy = unavailableMessage ??
    "Las cuentas est\u00e1n desactivadas en modo local; el men\u00fa y la compra como invitado siguen disponibles.";

  function enterDemo(kind: "owner" | "kitchen" | "customer") {
    if (kind === "owner") {
      resetStaffDemo();
      resetPensionDemo();
      loginDemo("owner");
      router.push("/admin");
      return;
    }
    if (kind === "kitchen") {
      resetPensionDemo();
      loginDemo("kitchen");
      setSelectedEmployee("demo-kitchen");
      router.push("/empleado");
      return;
    }
    useAdminStore.getState().logout();
    resetStaffDemo();
    setDemoProfile(PENSION_DEMO_PROFILES[2]!.id);
    router.push("/pensionado");
  }

  return (
    <section className="w-full max-w-md rounded-card border border-border-soft bg-surface p-5 shadow-card sm:p-7" aria-labelledby="auth-title">
      <h1 id="auth-title" className="text-2xl font-extrabold tracking-tight">{current.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {enabled ? "Usa tu cuenta opcional para guardar tu perfil y acceder de forma segura." : disabledCopy}
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {mode === "register" ? (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Nombre
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="rounded-xl border border-border-soft bg-background px-3 py-2.5 font-normal outline-none focus:border-lime" />
          </label>
        ) : null}
        {mode !== "update" ? (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Correo electr&oacute;nico
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete={mode === "login" ? "email" : "username"} className="rounded-xl border border-border-soft bg-background px-3 py-2.5 font-normal outline-none focus:border-lime" />
          </label>
        ) : null}
        {mode !== "recover" ? (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Contrase&ntilde;a
            <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} className="rounded-xl border border-border-soft bg-background px-3 py-2.5 font-normal outline-none focus:border-lime" />
          </label>
        ) : null}
        {mode === "register" || mode === "update" ? (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Repite la contrase&ntilde;a
            <input type="password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="rounded-xl border border-border-soft bg-background px-3 py-2.5 font-normal outline-none focus:border-lime" />
          </label>
        ) : null}
        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-lime">{message}</p> : null}
        <button type="submit" disabled={busy || !enabled} className="rounded-full bg-action px-5 py-3 font-extrabold text-action-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Procesando..." : current.submit}
        </button>
      </form>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={current.href} className="font-semibold text-lime underline-offset-4 hover:underline">{current.alternate}</Link>
        {mode === "login" ? <Link href="/recuperar-contrasena" className="text-muted underline-offset-4 hover:underline">&iquest;Olvidaste tu contrase&ntilde;a?</Link> : null}
      </div>
      <Link href="/menu" className="mt-5 block text-center text-sm font-semibold text-muted underline-offset-4 hover:underline">Continuar como invitado</Link>
      {!enabled && !unavailableMessage && mode === "login" ? (
        <div className="mt-6 border-t border-border-soft pt-5" aria-label="Accesos de demostración local">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Explorar demo local</p>
          <p className="mt-1 text-xs text-muted">Estos accesos no crean cuentas ni representan seguridad real.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => enterDemo("owner")} className="min-h-11 rounded-xl border border-border-soft px-3 text-sm font-bold">Administrador</button>
            <button type="button" onClick={() => enterDemo("kitchen")} className="min-h-11 rounded-xl border border-border-soft px-3 text-sm font-bold">Empleado</button>
            <button type="button" onClick={() => enterDemo("customer")} className="min-h-11 rounded-xl border border-border-soft px-3 text-sm font-bold">Cliente</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
