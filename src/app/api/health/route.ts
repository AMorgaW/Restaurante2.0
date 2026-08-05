import { NextResponse } from "next/server";
import { getAuthModeStatus, getDataModeStatus, getResolvedPaymentProvider } from "@/lib/env/server";
import { menuItems } from "@/data/menu";

export const dynamic = "force-dynamic";

/** Comprobación de salud: modo de datos activo y tamaño del menú. */
export async function GET() {
  const auth = getAuthModeStatus();
  const data = getDataModeStatus();
  const configurationValid = auth.mode !== "invalid" && data.mode !== "invalid" &&
    (auth.mode !== "supabase" || auth.configured) &&
    (data.mode !== "supabase" || data.configured);
  return NextResponse.json({
    status: configurationValid ? "ok" : "configuration_error",
    authMode: auth.mode,
    authConfigured: auth.configured,
    authConfigurationIssues: [...auth.missing, ...auth.invalid],
    dataMode: data.mode,
    dataConfigured: data.mode !== "supabase" || data.configured,
    dataConfigurationIssues: [...data.missing, ...data.invalid],
    paymentProvider: getResolvedPaymentProvider(),
    menuItems: menuItems.length,
  });
}
