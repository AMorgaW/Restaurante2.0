"use server";

import { revalidatePath } from "next/cache";
import { DiningTablesError, toSafeDiningTablesMessage } from "@/server/dining-tables/errors";
import {
  confirmManualOrderPayment,
  confirmManualTableSessionPayment,
  createDiningTable,
  rotateDiningTableQr,
  setDiningTableActive,
  voidManualPaymentConfirmation,
} from "@/server/dining-tables/service";
import type { DiningTableQrCredential, ManualPaymentConfirmationResult } from "@/types/dining-tables";

export type DiningTablesActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; code: string };

function revalidateDiningSurfaces() {
  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  revalidatePath("/empleado");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
}

function wrapError(error: unknown): { ok: false; message: string; code: string } {
  if (!(error instanceof DiningTablesError)) {
    console.error("[dining-tables] Error inesperado");
  }
  const safe = toSafeDiningTablesMessage(error);
  return { ok: false, message: safe.message, code: safe.code };
}

export async function createDiningTableAction(
  input: unknown,
): Promise<DiningTablesActionResult<DiningTableQrCredential>> {
  try {
    const data = await createDiningTable(input);
    revalidateDiningSurfaces();
    return { ok: true, data };
  } catch (error) {
    return wrapError(error);
  }
}

export async function setDiningTableActiveAction(
  input: unknown,
): Promise<DiningTablesActionResult> {
  try {
    await setDiningTableActive(input);
    revalidateDiningSurfaces();
    return { ok: true, data: undefined };
  } catch (error) {
    return wrapError(error);
  }
}

export async function rotateDiningTableQrAction(
  input: unknown,
): Promise<DiningTablesActionResult<DiningTableQrCredential>> {
  try {
    const data = await rotateDiningTableQr(input);
    revalidateDiningSurfaces();
    return { ok: true, data };
  } catch (error) {
    return wrapError(error);
  }
}

export async function confirmManualOrderPaymentAction(
  input: unknown,
): Promise<DiningTablesActionResult<ManualPaymentConfirmationResult>> {
  try {
    const data = await confirmManualOrderPayment(input);
    revalidateDiningSurfaces();
    return { ok: true, data };
  } catch (error) {
    return wrapError(error);
  }
}

export async function confirmManualTableSessionPaymentAction(
  input: unknown,
): Promise<DiningTablesActionResult<ManualPaymentConfirmationResult>> {
  try {
    const data = await confirmManualTableSessionPayment(input);
    revalidateDiningSurfaces();
    return { ok: true, data };
  } catch (error) {
    return wrapError(error);
  }
}

export async function voidManualPaymentConfirmationAction(
  input: unknown,
): Promise<DiningTablesActionResult<{ voidId: string; confirmationId: string; replay: boolean }>> {
  try {
    const data = await voidManualPaymentConfirmation(input);
    revalidateDiningSurfaces();
    return { ok: true, data };
  } catch (error) {
    return wrapError(error);
  }
}
