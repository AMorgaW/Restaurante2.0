const PRIVATE_AUTH_PREFIXES = [
  "/auth",
  "/cuenta",
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/actualizar-contrasena",
  "/admin",
  "/empleado",
  "/pensionado",
] as const;

export function isPrivateAuthPath(pathname: string): boolean {
  return PRIVATE_AUTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function hasSupabaseAuthCookie(names: readonly string[]): boolean {
  return names.some((name) => /^sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?$/.test(name));
}

export function requiresPrivateResponse({
  pathname,
  hadAuthCookie,
  authenticated,
  wroteCookies,
}: {
  pathname: string;
  hadAuthCookie: boolean;
  authenticated: boolean;
  wroteCookies: boolean;
}): boolean {
  return isPrivateAuthPath(pathname) || hadAuthCookie || authenticated || wroteCookies;
}

export function addVaryCookie(headers: Headers): void {
  const values = (headers.get("Vary") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.some((value) => value.toLowerCase() === "cookie")) values.push("Cookie");
  headers.set("Vary", values.join(", "));
}

export function isolatePrivateResponse(headers: Headers): void {
  headers.set("Cache-Control", "private, no-store, max-age=0");
  addVaryCookie(headers);
}
