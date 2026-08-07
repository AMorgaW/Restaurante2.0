"use server";

import { revalidatePath } from "next/cache";
import { toSafePensionMessage } from "@/server/pension/errors";
import {
  activatePensionMembership,
  changePensionMembershipStatus,
  closePensionMenu,
  createAndActivatePensionMembership,
  publishPensionMenu,
  renewPensionMembership,
  savePensionMenuDraft,
  searchPensionCustomers,
  setPensionDeliveryFee,
  upsertPensionMenuItem,
} from "@/server/pension/service";
import type { PensionCustomerSearchHit } from "@/server/pension/types";

export type PensionAdminActionResult =
  | { ok: true; message: string; code: string; data?: string | number }
  | { ok: false; message: string; code: string };

function revalidatePensionSurfaces() {
  revalidatePath("/admin/pensionados");
  revalidatePath("/pensionado");
  revalidatePath("/admin");
}

async function runPensionAdminAction(
  operation: () => Promise<string | number>,
  successMessage: string,
): Promise<PensionAdminActionResult> {
  try {
    const data = await operation();
    revalidatePensionSurfaces();
    return { ok: true, message: successMessage, code: "ok", data };
  } catch (error) {
    const safe = toSafePensionMessage(error);
    return { ok: false, message: safe.message, code: safe.code };
  }
}

export async function createAndActivatePensionMembershipAction(
  input: unknown,
): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(
    () => createAndActivatePensionMembership(input),
    "Membresía creada y activada.",
  );
}

export async function activatePensionMembershipAction(
  input: unknown,
): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(() => activatePensionMembership(input), "Membresía activada.");
}

export async function renewPensionMembershipAction(
  input: unknown,
): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(() => renewPensionMembership(input), "Membresía renovada.");
}

export async function changePensionMembershipStatusAction(
  input: unknown,
): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(
    () => changePensionMembershipStatus(input),
    "Estado de membresía actualizado.",
  );
}

export async function savePensionMenuDraftAction(
  input: unknown,
): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(() => savePensionMenuDraft(input), "Borrador de menú guardado.");
}

export async function upsertPensionMenuItemAction(
  input: unknown,
): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(() => upsertPensionMenuItem(input), "Ítem de menú guardado.");
}

export async function publishPensionMenuAction(
  input: unknown,
): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(() => publishPensionMenu(input), "Menú publicado.");
}

export async function closePensionMenuAction(input: unknown): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(() => closePensionMenu(input), "Menú cerrado.");
}

export async function setPensionDeliveryFeeAction(
  input: unknown,
): Promise<PensionAdminActionResult> {
  return runPensionAdminAction(
    () => setPensionDeliveryFee(input),
    "Fee de domicilio pensionado actualizado.",
  );
}

export type SearchPensionCustomersActionResult =
  | { ok: true; hits: PensionCustomerSearchHit[] }
  | { ok: false; message: string; code: string };

export async function searchPensionCustomersAction(
  query: string,
): Promise<SearchPensionCustomersActionResult> {
  try {
    const hits = await searchPensionCustomers(query);
    return { ok: true, hits };
  } catch (error) {
    const safe = toSafePensionMessage(error);
    return { ok: false, message: safe.message, code: safe.code };
  }
}
