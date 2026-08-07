"use server";

import { revalidatePath } from "next/cache";
import {
  applyStaffInventoryMovement,
  InventoryStaffError,
} from "@/server/inventory/staff-operations";

export type InventoryActionResult =
  | { ok: true }
  | { ok: false; message: string; code: string };

export async function applyInventoryMovementAction(input: unknown): Promise<InventoryActionResult> {
  try {
    await applyStaffInventoryMovement(input);
    revalidatePath("/admin/inventario");
    revalidatePath("/admin");
    revalidatePath("/empleado");
    return { ok: true };
  } catch (error) {
    if (error instanceof InventoryStaffError) {
      return { ok: false, message: error.message, code: error.code };
    }
    return { ok: false, message: "No se pudo registrar el movimiento.", code: "persist" };
  }
}
