import "server-only";
import { isSafeSupabasePublishableKey } from "@/lib/env/publishable-key";
import {
  getAuthModeStatusFromEnv,
  getDataModeStatusFromEnv,
  type AuthMode,
  type AuthModeStatus,
  type DataMode,
  type DataModeStatus,
} from "@/lib/env/modes";

export type ServerEnv = {
  AUTH_MODE?: string;
  DATA_MODE?: string;
  /** Interruptor servidor-only para C2.2; permanece desactivado por defecto. */
  GUEST_RECEIPT_RECOVERY_ENABLED?: string;
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAYMENT_PROVIDER: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  MERCADOPAGO_ACCESS_TOKEN?: string;
  MERCADOPAGO_WEBHOOK_SECRET?: string;
  EMAIL_PROVIDER: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

export type { AuthMode, AuthModeStatus, DataMode, DataModeStatus } from "@/lib/env/modes";

let cachedEnv: ServerEnv | null = null;

/** Conserva valores presentes tal como llegaron: un typo nunca se degrada a un default. */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;
  cachedEnv = {
    AUTH_MODE: process.env.AUTH_MODE,
    DATA_MODE: process.env.DATA_MODE,
    GUEST_RECEIPT_RECOVERY_ENABLED: process.env.GUEST_RECEIPT_RECOVERY_ENABLED,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Solo webhooks firmados / tareas internas. Nunca Auth SSR ni bootstrap de owner.
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? "demo",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
    MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? "none",
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };
  return cachedEnv;
}

/** La capacidad solo existe en Supabase y requiere activación explícita. */
export function isGuestReceiptRecoveryEnabled(env: ServerEnv = getServerEnv()): boolean {
  if (env.GUEST_RECEIPT_RECOVERY_ENABLED !== "true") return false;
  if (env.DATA_MODE !== "supabase") return false;
  const status = getDataModeStatusFromEnv(env);
  return status.mode === "supabase" && status.configured;
}

/** Preferencia estricta: una clave publishable presente pero invalida no cae a anon. */
export function getSupabasePublishableKey(env: ServerEnv = getServerEnv()): string | undefined {
  const candidate = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return isSafeSupabasePublishableKey(candidate) ? candidate : undefined;
}

export function getAuthModeStatus(): AuthModeStatus {
  return getAuthModeStatusFromEnv({ ...getServerEnv(), NODE_ENV: process.env.NODE_ENV });
}

export function getDataModeStatus(): DataModeStatus {
  return getDataModeStatusFromEnv(getServerEnv());
}

function configurationError(label: "AUTH_MODE" | "DATA_MODE", status: AuthModeStatus | DataModeStatus) {
  const fields = [...status.missing, ...status.invalid];
  return new Error(
    `[env] ${label} no tiene una configuracion valida (${fields.join(", ") || label}).`,
  );
}

export function getResolvedDataMode(): DataMode {
  const status = getDataModeStatus();
  if (status.mode === "local") return "local";
  if (status.mode === "invalid" || !status.configured) throw configurationError("DATA_MODE", status);
  return "supabase";
}

export function getResolvedAuthMode(): AuthMode {
  const status = getAuthModeStatus();
  if (status.mode === "disabled") return "disabled";
  if (status.mode === "invalid" || !status.configured) throw configurationError("AUTH_MODE", status);
  return "supabase";
}

export function getResolvedPaymentProvider(): "demo" | "stripe" | "mercadopago" {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "stripe" && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) return "stripe";
  if (env.PAYMENT_PROVIDER === "mercadopago" && env.MERCADOPAGO_ACCESS_TOKEN) return "mercadopago";
  if (env.PAYMENT_PROVIDER !== "demo") {
    console.error("[env] El proveedor de pagos solicitado no esta configurado; se mantiene el proveedor demo.");
  }
  return "demo";
}
