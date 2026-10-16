"use server";

import { revalidatePath } from "next/cache";
import { getDataModeStatus, isPublicOrderIntakeEnabled } from "@/lib/env/server";
import { toSafePensionMessage } from "@/server/pension/errors";
import { placePensionOrder } from "@/server/pension/service";
import type { CreatePensionOrderResult } from "@/server/pension/types";

export type PlacePensionOrderActionResult =
  | { ok: true; message: string; code: string; data: CreatePensionOrderResult }
  | { ok: false; message: string; code: string };

export async function placePensionOrderAction(
  input: unknown,
): Promise<PlacePensionOrderActionResult> {
  const dataMode = getDataModeStatus();
  if (dataMode.mode !== "supabase" || !isPublicOrderIntakeEnabled()) {
    return {
      ok: false,
      message: "La recepción de pedidos no está disponible temporalmente.",
      code: "public-order-intake-closed",
    };
  }

  try {
    const data = await placePensionOrder(input);
    revalidatePath("/pensionado");
    revalidatePath("/pedido");
    revalidatePath("/cuenta");
    return {
      ok: true,
      message: data.replay ? "Pedido pensionado ya confirmado." : "Pedido pensionado creado.",
      code: "ok",
      data,
    };
  } catch (error) {
    const safe = toSafePensionMessage(error);
    return { ok: false, message: safe.message, code: safe.code };
  }
}
