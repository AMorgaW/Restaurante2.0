import "server-only";

import { z } from "zod";
import {
  adminRoleCan,
  isAdminRole,
  type AdminRole,
} from "@/lib/admin/authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { DiningTablesError } from "@/server/dining-tables/errors";
import {
  LocalDiningTablesRepository,
  SupabaseDiningTablesRepository,
  type DiningTablesRepository,
} from "@/server/dining-tables/repository";
import type {
  DiningTableListItem,
  DiningTableQrCredential,
  ManualPaymentConfirmationResult,
  ManualPaymentHistory,
  ManualPaymentMethod,
  ResolvedTableQrPublic,
  TableSessionAccount,
} from "@/types/dining-tables";

const MANAGE_TABLE_ROLES = new Set<AdminRole>(["owner", "admin"]);
const PAYMENT_ROLES = new Set<AdminRole>(["owner", "admin", "manager", "cashier"]);
const VOID_ROLES = new Set<AdminRole>(["owner", "admin"]);
const READ_ROLES = new Set<AdminRole>(["owner", "admin", "manager", "cashier"]);

const uuid = z.string().uuid("Identificador inválido.");

const createTableSchema = z.object({
  branchId: uuid,
  code: z.string().trim().min(1, "Escribe el código de la mesa.").max(32),
  name: z.string().trim().max(80).optional().nullable(),
});

const setActiveSchema = z.object({
  tableId: uuid,
  isActive: z.boolean(),
});

const rotateSchema = z.object({
  tableId: uuid,
});

const confirmOrderSchema = z.object({
  orderId: uuid,
  method: z.enum(["cash", "bank_transfer", "zero_balance"]),
  reference: z.string().trim().max(120).optional().nullable(),
  idempotencyKey: uuid,
});

const confirmSessionSchema = z.object({
  sessionId: uuid,
  method: z.enum(["cash", "bank_transfer", "zero_balance"]),
  reference: z.string().trim().max(120).optional().nullable(),
  idempotencyKey: uuid,
});

const voidSchema = z.object({
  confirmationId: uuid,
  reason: z.string().trim().min(3, "Escribe un motivo.").max(300),
  idempotencyKey: uuid,
});

const historySchema = z.object({
  targetType: z.enum(["order", "table_session"]),
  targetId: uuid,
  limit: z.number().int().min(1).max(50).optional(),
});

let localSingleton: LocalDiningTablesRepository | null = null;

export function getDiningTablesRepository(): DiningTablesRepository {
  const mode = getResolvedDataMode();
  if (mode === "local") {
    if (!localSingleton) localSingleton = new LocalDiningTablesRepository();
    return localSingleton;
  }
  return new SupabaseDiningTablesRepository();
}

async function requireStaffSession(allowed: ReadonlySet<AdminRole>, capability?: "read-orders") {
  const mode = getResolvedDataMode();
  if (mode !== "supabase" && mode !== "local") {
    throw new DiningTablesError("Modo de datos no disponible.", "data-mode");
  }

  if (mode === "local") {
    return { mode, role: "owner" as AdminRole };
  }

  const session = await resolveServerSession();
  if (session.kind === "anonymous" || !session.profile) {
    throw new DiningTablesError("Debes iniciar sesión.", "unauthorized");
  }
  if (
    session.kind === "suspended_staff" ||
    session.profile.status === "suspended" ||
    session.profile.status === "inactive" ||
    session.profile.status === "invited"
  ) {
    throw new DiningTablesError("Tu cuenta de personal no está activa.", "forbidden");
  }
  if (!isAdminRole(session.profile.role) || !allowed.has(session.profile.role)) {
    throw new DiningTablesError("Tu rol no permite esta operación.", "forbidden");
  }
  if (capability && !adminRoleCan(session.profile.role, capability)) {
    throw new DiningTablesError("Tu rol no permite esta operación.", "forbidden");
  }
  return { mode, role: session.profile.role, session };
}

export async function listDiningTablesForStaff(input?: {
  branchId?: string | null;
  includeInactive?: boolean;
}): Promise<DiningTableListItem[]> {
  const { role } = await requireStaffSession(READ_ROLES, "read-orders");
  const includeInactive = Boolean(input?.includeInactive) && MANAGE_TABLE_ROLES.has(role);
  return getDiningTablesRepository().listDiningTables({
    branchId: input?.branchId ?? null,
    includeInactive,
  });
}

export async function createDiningTable(raw: unknown): Promise<DiningTableQrCredential> {
  await requireStaffSession(MANAGE_TABLE_ROLES);
  const parsed = createTableSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiningTablesError(
      parsed.error.issues[0]?.message ?? "Los datos de la mesa no son válidos.",
      "validation",
    );
  }
  return getDiningTablesRepository().createDiningTable(parsed.data);
}

export async function setDiningTableActive(raw: unknown): Promise<void> {
  await requireStaffSession(MANAGE_TABLE_ROLES);
  const parsed = setActiveSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiningTablesError("Los datos de la mesa no son válidos.", "validation");
  }
  await getDiningTablesRepository().setDiningTableActive(parsed.data);
}

export async function rotateDiningTableQr(raw: unknown): Promise<DiningTableQrCredential> {
  await requireStaffSession(MANAGE_TABLE_ROLES);
  const parsed = rotateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiningTablesError("Los datos de la mesa no son válidos.", "validation");
  }
  return getDiningTablesRepository().rotateDiningTableQr(parsed.data);
}

/**
 * Público: guest/auth. DB valida hash/activo y abre o reutiliza session.
 * No exige sesión staff.
 */
export async function resolveTableQrToken(qrToken: string): Promise<ResolvedTableQrPublic> {
  const token = qrToken.trim();
  if (!token || token.length > 200) {
    throw new DiningTablesError(
      "Este código QR ya no es válido. Solicita ayuda al personal.",
      "qr-invalid",
    );
  }
  return getDiningTablesRepository().resolveTableQr({ qrToken: token });
}

export async function getTableSessionAccountForStaff(sessionId: string): Promise<TableSessionAccount> {
  await requireStaffSession(READ_ROLES, "read-orders");
  if (!z.string().uuid().safeParse(sessionId).success) {
    throw new DiningTablesError("Sesión inválida.", "validation");
  }
  return getDiningTablesRepository().getTableSessionAccount({ sessionId });
}

export async function confirmManualOrderPayment(
  raw: unknown,
): Promise<ManualPaymentConfirmationResult> {
  await requireStaffSession(PAYMENT_ROLES, "read-orders");
  const parsed = confirmOrderSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiningTablesError(
      parsed.error.issues[0]?.message ?? "Los datos del cobro no son válidos.",
      "validation",
    );
  }
  // No amount / role / branch: solo order + method + reference + idempotency.
  return getDiningTablesRepository().confirmManualOrderPayment({
    orderId: parsed.data.orderId,
    method: parsed.data.method as ManualPaymentMethod,
    reference: parsed.data.reference ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
  });
}

export async function confirmManualTableSessionPayment(
  raw: unknown,
): Promise<ManualPaymentConfirmationResult> {
  await requireStaffSession(PAYMENT_ROLES, "read-orders");
  const parsed = confirmSessionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiningTablesError(
      parsed.error.issues[0]?.message ?? "Los datos del cobro no son válidos.",
      "validation",
    );
  }
  return getDiningTablesRepository().confirmManualTableSessionPayment({
    sessionId: parsed.data.sessionId,
    method: parsed.data.method as ManualPaymentMethod,
    reference: parsed.data.reference ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
  });
}

export async function voidManualPaymentConfirmation(raw: unknown): Promise<{
  voidId: string;
  confirmationId: string;
  replay: boolean;
}> {
  await requireStaffSession(VOID_ROLES);
  const parsed = voidSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiningTablesError(
      parsed.error.issues[0]?.message ?? "Los datos de anulación no son válidos.",
      "validation",
    );
  }
  return getDiningTablesRepository().voidManualPaymentConfirmation(parsed.data);
}

export async function getManualPaymentHistoryForStaff(raw: unknown): Promise<ManualPaymentHistory> {
  await requireStaffSession(READ_ROLES, "read-orders");
  const parsed = historySchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiningTablesError("Los datos de historial no son válidos.", "validation");
  }
  return getDiningTablesRepository().getManualPaymentHistory(parsed.data);
}

export function canManageDiningTables(role: AdminRole | null | undefined): boolean {
  return isAdminRole(role) && MANAGE_TABLE_ROLES.has(role);
}

export function canConfirmManualPayments(role: AdminRole | null | undefined): boolean {
  return isAdminRole(role) && PAYMENT_ROLES.has(role);
}

export function canVoidManualPayments(role: AdminRole | null | undefined): boolean {
  return isAdminRole(role) && VOID_ROLES.has(role);
}
