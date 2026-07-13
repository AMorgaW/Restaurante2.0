import "server-only";
import { z } from "zod";

/**
 * Validación de variables de entorno del SERVIDOR con degradación
 * controlada: la aplicación nunca se rompe por configuración ausente;
 * cae a modo local con un error claro en la consola del servidor.
 */

const serverEnvSchema = z.object({
  DATA_MODE: z.enum(["local", "supabase"]).default("local"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  PAYMENT_PROVIDER: z.enum(["demo", "stripe", "mercadopago"]).default("demo"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["none", "resend"]).default("none"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (parsed.success) {
    cachedEnv = parsed.data;
    return cachedEnv;
  }

  console.error(
    "[env] Variables de entorno inválidas; se usan valores seguros por defecto.",
    parsed.error.flatten().fieldErrors,
  );
  cachedEnv = serverEnvSchema.parse({});
  return cachedEnv;
}

export type DataMode = "local" | "supabase";

/**
 * Modo de datos efectivo. Si se pide `supabase` sin credenciales
 * completas, degrada a `local` explicando exactamente qué falta.
 */
export function getResolvedDataMode(): DataMode {
  const env = getServerEnv();
  if (env.DATA_MODE !== "supabase") return "local";

  const missing: string[] = [];
  if (!env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length > 0) {
    console.error(
      `[env] DATA_MODE=supabase pero faltan variables: ${missing.join(", ")}. ` +
        "La aplicación continúa en modo local (demo). " +
        "Configura las variables en .env.local (ver .env.example) para activar Supabase.",
    );
    return "local";
  }
  return "supabase";
}

/** Proveedor de pagos efectivo, degradando a demo si faltan credenciales. */
export function getResolvedPaymentProvider(): "demo" | "stripe" | "mercadopago" {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "stripe" && (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)) {
    console.error(
      "[env] PAYMENT_PROVIDER=stripe pero faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET; se usa el proveedor demo.",
    );
    return "demo";
  }
  if (env.PAYMENT_PROVIDER === "mercadopago" && !env.MERCADOPAGO_ACCESS_TOKEN) {
    console.error(
      "[env] PAYMENT_PROVIDER=mercadopago pero falta MERCADOPAGO_ACCESS_TOKEN; se usa el proveedor demo.",
    );
    return "demo";
  }
  return env.PAYMENT_PROVIDER;
}
