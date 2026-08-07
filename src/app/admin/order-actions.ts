"use server";

import { revalidatePath } from "next/cache";
import { StaffOrderError, toSafeStaffOrderMessage } from "@/server/orders/staff-errors";
import { transitionOrderStatus } from "@/server/orders/staff-operations";

export type OrderStatusActionResult =
  | { ok: true }
  | { ok: false; message: string; code: string };

function revalidateOrderSurfaces() {
  revalidatePath("/empleado");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/inventario");
}

export async function transitionOrderStatusAction(input: unknown): Promise<OrderStatusActionResult> {
  try {
    await transitionOrderStatus(input);
    revalidateOrderSurfaces();
    return { ok: true };
  } catch (error) {
    if (!(error instanceof StaffOrderError)) {
      console.error("[staff-orders] Error inesperado");
    }
    const safe = toSafeStaffOrderMessage(error);
    return { ok: false, message: safe.message, code: safe.code };
  }
}
