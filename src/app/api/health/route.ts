import { NextResponse } from "next/server";
import { getResolvedDataMode, getResolvedPaymentProvider } from "@/lib/env/server";
import { menuItems } from "@/data/menu";

export const dynamic = "force-dynamic";

/** Comprobación de salud: modo de datos activo y tamaño del menú. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    dataMode: getResolvedDataMode(),
    paymentProvider: getResolvedPaymentProvider(),
    menuItems: menuItems.length,
  });
}
