import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { getAuthModeStatus } from "@/lib/env/server";
import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { AccountDemoScreen } from "@/components/auth/account-screen";
import { resolvePostLoginDestination } from "@/lib/session/destination";
import { resolveSession } from "@/lib/session/resolver";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const status = getAuthModeStatus();
  if (status.mode === "disabled") {
    return <AccountDemoScreen />;
  }
  if (!status.configured) {
    const issues = [...status.missing, ...status.invalid];
    return (
      <AuthPageShell>
        <section className="w-full max-w-md rounded-card border border-border-soft bg-surface p-6">
          <h1 className="text-2xl font-extrabold">Cuenta no disponible</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            La configuracion de Auth es invalida o incompleta ({issues.join(", ") || "AUTH_MODE"}).
            El acceso permanece cerrado.
          </p>
        </section>
      </AuthPageShell>
    );
  }

  const context = await getAuthenticatedProfile();
  if (!context) redirect(`/login?next=${encodeURIComponent("/cuenta")}`);
  const profile = context.profile;
  const session = resolveSession({ source: "supabase", user: { id: context.user.id, email: context.user.email }, profile });
  const destination = resolvePostLoginDestination(session);
  return (
    <AuthPageShell>
      <section className="w-full max-w-md rounded-card border border-border-soft bg-surface p-6" aria-labelledby="account-title">
        <h1 id="account-title" className="text-2xl font-extrabold">Mi cuenta</h1>
        {profile ? (
          <dl className="mt-5 grid gap-3 text-sm">
            <div><dt className="font-semibold text-muted">Correo</dt><dd>{profile.email ?? context.user.email}</dd></div>
            <div><dt className="font-semibold text-muted">Nombre</dt><dd>{profile.name || "Sin nombre"}</dd></div>
            <div><dt className="font-semibold text-muted">Rol</dt><dd>{profile.role === "customer" ? "Cliente" : "Personal autorizado"}</dd></div>
            <div><dt className="font-semibold text-muted">Acceso principal</dt><dd>{destination}</dd></div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted">Tu sesión es válida, pero el perfil aún no está disponible. Intenta recargar.</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={destination} className="rounded-full bg-action px-5 py-3 text-sm font-extrabold text-action-foreground">Ir a mi espacio</Link>
          <Link href="/menu" className="rounded-full border border-border-soft px-5 py-3 text-sm font-bold">Ir al menú</Link>
          <form action="/auth/signout" method="post"><button type="submit" className="rounded-full border border-border-soft px-5 py-3 text-sm font-bold">Cerrar sesión</button></form>
        </div>
      </section>
    </AuthPageShell>
  );
}
