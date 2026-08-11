import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

type SupabaseCliStatus = Record<string, unknown>;

export type LocalSupabaseBrowserEnv = {
  url: string;
  publishableKey: string;
  anonKey: string;
};

export type LocalSupabaseServerEnv = LocalSupabaseBrowserEnv & {
  serviceRoleKey: string;
  testPassword: string;
};

type LocalSupabaseWebServerOptions = {
  siteUrl: string;
  authMode?: "disabled" | "supabase";
};

const WEB_SERVER_INHERITED_ENV = [
  "APPDATA",
  "CI",
  "ComSpec",
  "HOME",
  "LOCALAPPDATA",
  "PATH",
  "Path",
  "PATHEXT",
  "PLAYWRIGHT_BROWSERS_PATH",
  "PROGRAMFILES",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "SYSTEMROOT",
  "SystemRoot",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WINDIR",
] as const;

let cliStatus: SupabaseCliStatus | undefined;
let generatedTestPassword: string | undefined;

function readNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readCliValue(status: SupabaseCliStatus, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = status[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function getCliStatus(): SupabaseCliStatus {
  if (cliStatus) return cliStatus;

  try {
    const output = execFileSync("supabase", ["status", "-o", "json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(output) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid status payload");
    }
    cliStatus = parsed as SupabaseCliStatus;
    return cliStatus;
  } catch {
    throw new Error(
      "No se pudo leer el stack Supabase local. Inícialo o define las variables SUPABASE_LOCAL_*; ningún valor sensible fue mostrado.",
    );
  }
}

function assertLoopbackUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SUPABASE_LOCAL_URL debe ser una URL válida de loopback.");
  }

  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("SUPABASE_LOCAL_URL debe apuntar exclusivamente al stack local por loopback.");
  }
  return url.origin;
}

function decodeJwtRole(value: string): string | undefined {
  const segments = value.split(".");
  if (segments.length !== 3) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(segments[1]!, "base64url").toString("utf8")) as {
      role?: unknown;
    };
    return typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

function assertAnonKey(value: string): string {
  if (decodeJwtRole(value) !== "anon") {
    throw new Error("SUPABASE_LOCAL_ANON_KEY no es un JWT local con rol anon.");
  }
  return value;
}

function assertPublishableKey(value: string, anonKey: string): string {
  if (value === anonKey || decodeJwtRole(value) === "anon" || /^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(value)) {
    return value;
  }
  throw new Error("SUPABASE_LOCAL_PUBLISHABLE_KEY no tiene formato publicable válido.");
}

function assertServiceRoleKey(value: string): string {
  if (decodeJwtRole(value) === "service_role" || /^sb_secret_[A-Za-z0-9_-]{10,}$/.test(value)) {
    return value;
  }
  throw new Error("SUPABASE_LOCAL_SERVICE_ROLE_KEY no es una credencial local privilegiada válida.");
}

function resolveBrowserEnv(): LocalSupabaseBrowserEnv {
  const directUrl = readNonEmpty(process.env.SUPABASE_LOCAL_URL);
  const directAnon = readNonEmpty(process.env.SUPABASE_LOCAL_ANON_KEY);
  const directPublishable = readNonEmpty(process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY);
  const status = directUrl && directAnon && directPublishable ? undefined : getCliStatus();

  const url = directUrl ?? readCliValue(status!, "API_URL", "api_url");
  const anonKey = directAnon ?? readCliValue(status!, "ANON_KEY", "anon_key");
  const publishableKey =
    directPublishable ??
    readCliValue(status!, "PUBLISHABLE_KEY", "publishable_key") ??
    anonKey;

  if (!url || !anonKey || !publishableKey) {
    throw new Error(
      "Falta configuración Supabase local. Define SUPABASE_LOCAL_URL, SUPABASE_LOCAL_ANON_KEY y SUPABASE_LOCAL_PUBLISHABLE_KEY.",
    );
  }

  const safeAnon = assertAnonKey(anonKey);
  return {
    url: assertLoopbackUrl(url),
    anonKey: safeAnon,
    publishableKey: assertPublishableKey(publishableKey, safeAnon),
  };
}

/** Solo valores aptos para el servidor web de pruebas; nunca incluye service_role. */
export function getLocalSupabaseBrowserEnv(): LocalSupabaseBrowserEnv {
  return resolveBrowserEnv();
}

/** Construye el entorno del Next local sin propagar credenciales server-only del harness. */
export function getLocalSupabaseWebServerEnv({
  siteUrl,
  authMode = "supabase",
}: LocalSupabaseWebServerOptions): Record<string, string> {
  const browser = resolveBrowserEnv();
  const inherited: Record<string, string> = {};
  for (const name of WEB_SERVER_INHERITED_ENV) {
    const value = process.env[name];
    if (value) inherited[name] = value;
  }

  return {
    ...inherited,
    AUTH_MODE: authMode,
    DATA_MODE: "supabase",
    NEXT_PUBLIC_SITE_URL: siteUrl,
    NEXT_PUBLIC_SUPABASE_URL: browser.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: browser.publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: browser.anonKey,
  };
}

/** Credenciales exclusivas del proceso Node de fixtures/integración. */
export function getLocalSupabaseServerEnv(): LocalSupabaseServerEnv {
  const browser = resolveBrowserEnv();
  const directServiceRole = readNonEmpty(process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY);
  const status = directServiceRole ? undefined : getCliStatus();
  const serviceRoleKey =
    directServiceRole ??
    readCliValue(status!, "SERVICE_ROLE_KEY", "service_role_key", "SECRET_KEY", "secret_key");

  if (!serviceRoleKey) {
    throw new Error("Falta SUPABASE_LOCAL_SERVICE_ROLE_KEY para crear fixtures Auth locales.");
  }

  generatedTestPassword ??=
    readNonEmpty(process.env.SUPABASE_LOCAL_TEST_PASSWORD) ??
    `${randomBytes(24).toString("base64url")}Aa1!`;

  return {
    ...browser,
    serviceRoleKey: assertServiceRoleKey(serviceRoleKey),
    testPassword: generatedTestPassword,
  };
}
