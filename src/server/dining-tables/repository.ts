import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DiningTablesError, mapDiningTablesRpcError } from "@/server/dining-tables/errors";
import {
  mapDiningTableList,
  mapManualPaymentConfirmationResult,
  mapManualPaymentHistory,
  mapResolvedTableQr,
  mapTableSessionAccount,
} from "@/server/dining-tables/mappers";
import type {
  DiningTableListItem,
  DiningTableQrCredential,
  ManualPaymentConfirmationResult,
  ManualPaymentHistory,
  ManualPaymentMethod,
  ResolvedTableQrPublic,
  TableSessionAccount,
} from "@/types/dining-tables";
import type { Database, Json } from "@/types/database.generated";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message?: string; code?: string; details?: string; hint?: string } | null;
  }>;
};

async function callRpc(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const client = await createServerSupabaseClient();
  const { data, error } = await (client as unknown as RpcClient).rpc(fn, args);
  if (error) throw mapDiningTablesRpcError(error);
  return data;
}

export interface DiningTablesRepository {
  listDiningTables(input: {
    branchId?: string | null;
    includeInactive?: boolean;
  }): Promise<DiningTableListItem[]>;
  createDiningTable(input: {
    branchId: string;
    code: string;
    name?: string | null;
  }): Promise<DiningTableQrCredential>;
  setDiningTableActive(input: { tableId: string; isActive: boolean }): Promise<void>;
  rotateDiningTableQr(input: { tableId: string }): Promise<DiningTableQrCredential>;
  resolveTableQr(input: { qrToken: string }): Promise<ResolvedTableQrPublic>;
  getTableSessionAccount(input: { sessionId: string }): Promise<TableSessionAccount>;
  confirmManualOrderPayment(input: {
    orderId: string;
    method: ManualPaymentMethod;
    reference?: string | null;
    idempotencyKey: string;
  }): Promise<ManualPaymentConfirmationResult>;
  confirmManualTableSessionPayment(input: {
    sessionId: string;
    method: ManualPaymentMethod;
    reference?: string | null;
    idempotencyKey: string;
  }): Promise<ManualPaymentConfirmationResult>;
  voidManualPaymentConfirmation(input: {
    confirmationId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<{ voidId: string; confirmationId: string; replay: boolean }>;
  getManualPaymentHistory(input: {
    targetType: "order" | "table_session";
    targetId: string;
    limit?: number;
  }): Promise<ManualPaymentHistory>;
}

/** Demo local explícito: no se usa como fallback de supabase. */
export class LocalDiningTablesRepository implements DiningTablesRepository {
  private tables: DiningTableListItem[] = [
    {
      tableId: "local-table-1",
      branchId: "branch-centro",
      code: "1",
      name: "Mesa 1",
      isActive: true,
      openSessionId: null,
      sessionOpenedAt: null,
      orderCount: 0,
      accountTotal: 0,
      outstandingTotal: 0,
      operationalStatus: "free",
    },
    {
      tableId: "local-table-2",
      branchId: "branch-centro",
      code: "2",
      name: "Mesa 2",
      isActive: true,
      openSessionId: "local-session-2",
      sessionOpenedAt: new Date().toISOString(),
      orderCount: 2,
      accountTotal: 43000,
      outstandingTotal: 43000,
      operationalStatus: "open_account",
    },
  ];

  async listDiningTables(input: {
    branchId?: string | null;
    includeInactive?: boolean;
  }): Promise<DiningTableListItem[]> {
    return this.tables.filter((table) => {
      if (input.branchId && table.branchId !== input.branchId) return false;
      if (!input.includeInactive && !table.isActive) return false;
      return true;
    });
  }

  async createDiningTable(input: {
    branchId: string;
    code: string;
    name?: string | null;
  }): Promise<DiningTableQrCredential> {
    const code = input.code.trim();
    if (this.tables.some((table) => table.branchId === input.branchId && table.code === code)) {
      throw new DiningTablesError(
        "Ya existe una mesa con ese código en la sucursal.",
        "table-code-duplicate",
      );
    }
    const tableId = `local-table-${crypto.randomUUID()}`;
    const qrToken = `local-qr-${crypto.randomUUID().replace(/-/g, "")}`;
    this.tables.push({
      tableId,
      branchId: input.branchId,
      code,
      name: input.name?.trim() || null,
      isActive: true,
      openSessionId: null,
      sessionOpenedAt: null,
      orderCount: 0,
      accountTotal: 0,
      outstandingTotal: 0,
      operationalStatus: "free",
    });
    return { tableId, branchId: input.branchId, code, qrToken };
  }

  async setDiningTableActive(input: { tableId: string; isActive: boolean }): Promise<void> {
    const table = this.tables.find((candidate) => candidate.tableId === input.tableId);
    if (!table) throw new DiningTablesError("No encontramos esa mesa.", "table-not-found");
    table.isActive = input.isActive;
    table.operationalStatus = !input.isActive
      ? "inactive"
      : table.openSessionId
        ? "open_account"
        : "free";
  }

  async rotateDiningTableQr(input: { tableId: string }): Promise<DiningTableQrCredential> {
    const table = this.tables.find((candidate) => candidate.tableId === input.tableId);
    if (!table) throw new DiningTablesError("No encontramos esa mesa.", "table-not-found");
    return {
      tableId: table.tableId,
      branchId: table.branchId,
      code: table.code,
      qrToken: `local-qr-${crypto.randomUUID().replace(/-/g, "")}`,
    };
  }

  async resolveTableQr(input: { qrToken: string }): Promise<ResolvedTableQrPublic> {
    if (!input.qrToken.startsWith("local-qr-")) {
      throw new DiningTablesError(
        "Este código QR ya no es válido. Solicita ayuda al personal.",
        "qr-invalid",
      );
    }
    const table = this.tables.find((candidate) => candidate.isActive) ?? this.tables[0];
    if (!table || !table.isActive) {
      throw new DiningTablesError(
        "Este código QR ya no es válido. Solicita ayuda al personal.",
        "qr-invalid",
      );
    }
    return {
      code: table.code,
      name: table.name,
      branchId: table.branchId,
      tableId: table.tableId,
      sessionId: table.openSessionId ?? `local-session-${table.tableId}`,
      sessionStatus: "open",
    };
  }

  async getTableSessionAccount(input: { sessionId: string }): Promise<TableSessionAccount> {
    const table = this.tables.find((candidate) => candidate.openSessionId === input.sessionId);
    if (!table || !table.openSessionId) {
      throw new DiningTablesError("No encontramos el objetivo del cobro o la consulta.", "target-conflict");
    }
    return {
      session: {
        sessionId: table.openSessionId,
        tableId: table.tableId,
        tableCode: table.code,
        tableName: table.name,
        branchId: table.branchId,
        status: "open",
        openedAt: table.sessionOpenedAt ?? new Date().toISOString(),
        closedAt: null,
        openedBy: null,
        closedBy: null,
      },
      orders: [
        {
          orderId: "local-order-a",
          orderNumber: "BS-LOCAL-A",
          status: "preparing",
          paymentStatus: "pending",
          paymentMethod: null,
          paymentReference: null,
          total: 25000,
          createdAt: new Date().toISOString(),
          orderKind: "standard",
          fulfillmentType: "local",
          activeManualPaymentConfirmationId: null,
        },
        {
          orderId: "local-order-b",
          orderNumber: "BS-LOCAL-B",
          status: "delivered",
          paymentStatus: "pending",
          paymentMethod: null,
          paymentReference: null,
          total: 18000,
          createdAt: new Date().toISOString(),
          orderKind: "standard",
          fulfillmentType: "local",
          activeManualPaymentConfirmationId: null,
        },
      ],
      summary: {
        orderCount: table.orderCount,
        accountTotal: table.accountTotal,
        outstandingTotal: table.outstandingTotal,
        paidCount: 0,
        pendingCount: table.orderCount,
      },
    };
  }

  async confirmManualOrderPayment(): Promise<ManualPaymentConfirmationResult> {
    return {
      confirmationId: crypto.randomUUID(),
      replay: false,
      amount: 20000,
      method: "cash",
      paymentReference: null,
      targetType: "order",
    };
  }

  async confirmManualTableSessionPayment(input: {
    sessionId: string;
    method: ManualPaymentMethod;
    reference?: string | null;
    idempotencyKey: string;
  }): Promise<ManualPaymentConfirmationResult> {
    const table = this.tables.find((candidate) => candidate.openSessionId === input.sessionId);
    if (!table) {
      throw new DiningTablesError("No encontramos el objetivo del cobro o la consulta.", "target-conflict");
    }
    const amount = table.outstandingTotal;
    table.openSessionId = null;
    table.sessionOpenedAt = null;
    table.orderCount = 0;
    table.accountTotal = 0;
    table.outstandingTotal = 0;
    table.operationalStatus = table.isActive ? "free" : "inactive";
    return {
      confirmationId: crypto.randomUUID(),
      replay: false,
      amount,
      method: input.method,
      paymentReference: input.reference ?? null,
      targetType: "table_session",
      sessionId: input.sessionId,
      sessionStatus: "closed",
    };
  }

  async voidManualPaymentConfirmation(input: {
    confirmationId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<{ voidId: string; confirmationId: string; replay: boolean }> {
    void input.reason;
    void input.idempotencyKey;
    return {
      voidId: crypto.randomUUID(),
      confirmationId: input.confirmationId,
      replay: false,
    };
  }

  async getManualPaymentHistory(): Promise<ManualPaymentHistory> {
    return [];
  }
}

export class SupabaseDiningTablesRepository implements DiningTablesRepository {
  async listDiningTables(input: {
    branchId?: string | null;
    includeInactive?: boolean;
  }): Promise<DiningTableListItem[]> {
    const args: Database["public"]["Functions"]["list_dining_tables_for_staff"]["Args"] = {
      p_branch_id: input.branchId ?? undefined,
      p_include_inactive: input.includeInactive ?? false,
    };
    const data = await callRpc("list_dining_tables_for_staff", args);
    return mapDiningTableList(data);
  }

  async createDiningTable(input: {
    branchId: string;
    code: string;
    name?: string | null;
  }): Promise<DiningTableQrCredential> {
    const data = await callRpc("create_dining_table", {
      p_branch_id: input.branchId,
      p_code: input.code,
      p_name: input.name ?? null,
    });
    const row = Array.isArray(data) ? data[0] : data;
    const record = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (
      !record ||
      typeof record.table_id !== "string" ||
      typeof record.qr_token !== "string" ||
      typeof record.code !== "string"
    ) {
      throw new DiningTablesError("No pudimos crear la mesa.", "persistence-error");
    }
    return {
      tableId: record.table_id,
      branchId: typeof record.branch_id === "string" ? record.branch_id : input.branchId,
      code: record.code,
      qrToken: record.qr_token,
    };
  }

  async setDiningTableActive(input: { tableId: string; isActive: boolean }): Promise<void> {
    await callRpc("set_dining_table_active", {
      p_table_id: input.tableId,
      p_is_active: input.isActive,
    });
  }

  async rotateDiningTableQr(input: { tableId: string }): Promise<DiningTableQrCredential> {
    const data = await callRpc("rotate_dining_table_qr", { p_table_id: input.tableId });
    const row = Array.isArray(data) ? data[0] : data;
    const record = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (!record || typeof record.table_id !== "string" || typeof record.qr_token !== "string") {
      throw new DiningTablesError("No pudimos rotar el QR.", "persistence-error");
    }
    return { tableId: record.table_id, qrToken: record.qr_token };
  }

  async resolveTableQr(input: { qrToken: string }): Promise<ResolvedTableQrPublic> {
    const data = await callRpc("resolve_table_qr", { p_qr_token: input.qrToken });
    const mapped = mapResolvedTableQr(data);
    if (!mapped) {
      throw new DiningTablesError(
        "Este código QR ya no es válido. Solicita ayuda al personal.",
        "qr-invalid",
      );
    }
    return mapped;
  }

  async getTableSessionAccount(input: { sessionId: string }): Promise<TableSessionAccount> {
    const data = await callRpc("get_table_session_account", { p_session_id: input.sessionId });
    const mapped = mapTableSessionAccount(data);
    if (!mapped) {
      throw new DiningTablesError("No se pudo cargar la cuenta de la mesa.", "persistence-error");
    }
    return mapped;
  }

  async confirmManualOrderPayment(input: {
    orderId: string;
    method: ManualPaymentMethod;
    reference?: string | null;
    idempotencyKey: string;
  }): Promise<ManualPaymentConfirmationResult> {
    const data = await callRpc("confirm_manual_order_payment", {
      p_order_id: input.orderId,
      p_method: input.method,
      p_reference: input.reference ?? "",
      p_idempotency_key: input.idempotencyKey,
    });
    const mapped = mapManualPaymentConfirmationResult(data);
    if (!mapped) {
      throw new DiningTablesError("No pudimos confirmar el cobro.", "persistence-error");
    }
    return { ...mapped, targetType: "order" };
  }

  async confirmManualTableSessionPayment(input: {
    sessionId: string;
    method: ManualPaymentMethod;
    reference?: string | null;
    idempotencyKey: string;
  }): Promise<ManualPaymentConfirmationResult> {
    const data = await callRpc("confirm_manual_table_session_payment", {
      p_session_id: input.sessionId,
      p_method: input.method,
      p_reference: input.reference ?? "",
      p_idempotency_key: input.idempotencyKey,
    });
    const mapped = mapManualPaymentConfirmationResult(data);
    if (!mapped) {
      throw new DiningTablesError("No pudimos confirmar el cobro de la mesa.", "persistence-error");
    }
    return {
      ...mapped,
      targetType: "table_session",
      sessionId: input.sessionId,
    };
  }

  async voidManualPaymentConfirmation(input: {
    confirmationId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<{ voidId: string; confirmationId: string; replay: boolean }> {
    const data = await callRpc("void_manual_payment_confirmation", {
      p_confirmation_id: input.confirmationId,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
    });
    const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    if (
      !record ||
      typeof record.void_id !== "string" ||
      typeof record.confirmation_id !== "string"
    ) {
      throw new DiningTablesError("No pudimos anular la confirmación.", "persistence-error");
    }
    return {
      voidId: record.void_id,
      confirmationId: record.confirmation_id,
      replay: typeof record.replay === "boolean" ? record.replay : false,
    };
  }

  async getManualPaymentHistory(input: {
    targetType: "order" | "table_session";
    targetId: string;
    limit?: number;
  }): Promise<ManualPaymentHistory> {
    const data = await callRpc("get_manual_payment_history", {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_limit: input.limit ?? 20,
    });
    return mapManualPaymentHistory(data as Json);
  }
}
