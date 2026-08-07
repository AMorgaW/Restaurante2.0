import { isSafeSupabasePublishableKey } from "@/lib/env/publishable-key";

export type AuthMode = "disabled" | "supabase";
export type DataMode = "local" | "supabase";
export type ModeState<T extends string> = T | "invalid";
export type AuthModeStatus = {
  mode: ModeState<AuthMode>;
  configured: boolean;
  missing: string[];
  invalid: string[];
};
export type DataModeStatus = {
  mode: ModeState<DataMode>;
  configured: boolean;
  missing: string[];
  invalid: string[];
};

export type ModeEnvironment = {
  AUTH_MODE?: string;
  DATA_MODE?: string;
  NODE_ENV?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  /** @deprecated Preferir NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; solo compatibilidad JWT anon local. */
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

function isValidSupabaseUrl(candidate: string | undefined): boolean {
  if (!candidate || candidate.trim() !== candidate || /\s/.test(candidate)) return false;
  try {
    const url = new URL(candidate);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password && !/your-project|placeholder/i.test(url.hostname);
  } catch {
    return false;
  }
}

function getSupabaseConfiguration(env: ModeEnvironment) {
  const missing: string[] = [];
  const invalid: string[] = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const keyName = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined
    ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    : "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url === undefined) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  else if (!isValidSupabaseUrl(url)) invalid.push("NEXT_PUBLIC_SUPABASE_URL");

  if (key === undefined) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  else if (!isSafeSupabasePublishableKey(key)) invalid.push(keyName);

  return { missing, invalid };
}

export function getAuthModeStatusFromEnv(env: ModeEnvironment): AuthModeStatus {
  const isProduction = env.NODE_ENV === "production";

  // Producción no cae en demo por omisión (AUTH_MODE ausente).
  // AUTH_MODE=disabled explícito sigue permitido (p. ej. E2E / demos etiquetados).
  if (env.AUTH_MODE === undefined) {
    if (isProduction) {
      return { mode: "invalid", configured: false, missing: ["AUTH_MODE"], invalid: [] };
    }
    return { mode: "disabled", configured: false, missing: [], invalid: [] };
  }
  if (env.AUTH_MODE !== "disabled" && env.AUTH_MODE !== "supabase") {
    return { mode: "invalid", configured: false, missing: [], invalid: ["AUTH_MODE"] };
  }
  if (env.AUTH_MODE === "disabled") {
    return { mode: "disabled", configured: false, missing: [], invalid: [] };
  }
  const config = getSupabaseConfiguration(env);
  return {
    mode: "supabase",
    configured: config.missing.length === 0 && config.invalid.length === 0,
    ...config,
  };
}

export function getDataModeStatusFromEnv(env: ModeEnvironment): DataModeStatus {
  if (env.DATA_MODE === undefined) {
    return { mode: "local", configured: false, missing: [], invalid: [] };
  }
  if (env.DATA_MODE !== "local" && env.DATA_MODE !== "supabase") {
    return { mode: "invalid", configured: false, missing: [], invalid: ["DATA_MODE"] };
  }
  if (env.DATA_MODE === "local") {
    return { mode: "local", configured: false, missing: [], invalid: [] };
  }
  const config = getSupabaseConfiguration(env);
  return {
    mode: "supabase",
    configured: config.missing.length === 0 && config.invalid.length === 0,
    ...config,
  };
}
