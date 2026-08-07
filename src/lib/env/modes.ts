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
  /** Solo valores de proceso Node (`production` | `development` | `test`); no proviene del navegador. */
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

/** Demo solo cuando el modo canónico resuelto es exactamente `disabled`. */
export function isDemoAuthMode(status: AuthModeStatus): boolean {
  return status.mode === "disabled";
}

/**
 * Resolución canónica de AUTH_MODE.
 * - production: solo `supabase` con config válida; ausente/disabled/demo/otro → invalid.
 * - development|test: `supabase` (config válida) o `disabled` explícito; ausente/demo/otro → invalid.
 * Sin coincidencia parcial ni fallback implícito a demo.
 */
export function getAuthModeStatusFromEnv(env: ModeEnvironment): AuthModeStatus {
  const allowsDisabled = env.NODE_ENV === "development" || env.NODE_ENV === "test";

  if (env.AUTH_MODE === undefined) {
    return { mode: "invalid", configured: false, missing: ["AUTH_MODE"], invalid: [] };
  }

  if (env.AUTH_MODE === "disabled") {
    if (!allowsDisabled) {
      return { mode: "invalid", configured: false, missing: [], invalid: ["AUTH_MODE"] };
    }
    return { mode: "disabled", configured: false, missing: [], invalid: [] };
  }

  if (env.AUTH_MODE === "supabase") {
    const config = getSupabaseConfiguration(env);
    if (config.missing.length > 0 || config.invalid.length > 0) {
      return { mode: "invalid", configured: false, ...config };
    }
    return { mode: "supabase", configured: true, missing: [], invalid: [] };
  }

  return { mode: "invalid", configured: false, missing: [], invalid: ["AUTH_MODE"] };
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
