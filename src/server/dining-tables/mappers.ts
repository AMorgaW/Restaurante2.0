import type {
  DiningTableListItem,
  ManualConfirmationKind,
  ManualPaymentAllocation,
  ManualPaymentConfirmationResult,
  ManualPaymentHistory,
  ManualPaymentHistoryEntry,
  ManualPaymentHistoryStatus,
  ManualPaymentHistoryTargetType,
  ManualPaymentMethod,
  ManualPaymentVoid,
  ResolvedTableQrPublic,
  TableOperationalState,
  TableSession,
  TableSessionAccount,
  TableSessionAccountSummary,
  TableSessionOrder,
  TableSessionStatus,
} from "@/types/dining-tables";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asOperationalStatus(value: unknown): TableOperationalState | null {
  return value === "inactive" || value === "free" || value === "open_account" ? value : null;
}

function asSessionStatus(value: unknown): TableSessionStatus | null {
  return value === "open" || value === "closed" ? value : null;
}

function asTargetType(value: unknown): ManualPaymentHistoryTargetType | null {
  return value === "order" || value === "table_session" ? value : null;
}

function asHistoryStatus(value: unknown): ManualPaymentHistoryStatus | null {
  return value === "active" || value === "voided" ? value : null;
}

/**
 * 0014 expone confirmation_kind DB (`manual` | `zero_balance`).
 * Para UI se proyecta al método efectivo (`cash` | `bank_transfer` | `zero_balance`).
 */
function asConfirmationKind(
  kind: unknown,
  method?: unknown,
): ManualConfirmationKind | null {
  if (kind === "zero_balance") return "zero_balance";
  if (kind === "cash" || kind === "bank_transfer") return kind;
  if (kind === "manual" && (method === "cash" || method === "bank_transfer")) {
    return method;
  }
  return null;
}

export function mapDiningTableListItem(raw: unknown): DiningTableListItem | null {
  const row = asRecord(raw);
  if (!row) return null;
  const tableId = asString(row.table_id);
  const branchId = asString(row.branch_id);
  const code = asString(row.code);
  const isActive = asBoolean(row.is_active);
  const orderCount = asNumber(row.order_count);
  const accountTotal = asNumber(row.account_total);
  const outstandingTotal = asNumber(row.outstanding_total);
  const operationalStatus = asOperationalStatus(row.operational_status);
  if (
    !tableId ||
    !branchId ||
    !code ||
    isActive === null ||
    orderCount === null ||
    accountTotal === null ||
    outstandingTotal === null ||
    !operationalStatus
  ) {
    return null;
  }
  return {
    tableId,
    branchId,
    code,
    name: asString(row.name),
    isActive,
    openSessionId: asString(row.open_session_id),
    sessionOpenedAt: asString(row.session_opened_at),
    orderCount,
    accountTotal,
    outstandingTotal,
    operationalStatus,
  };
}

export function mapDiningTableList(raw: unknown): DiningTableListItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(mapDiningTableListItem).filter((item): item is DiningTableListItem => item !== null);
}

export function mapTableSessionOrder(raw: unknown): TableSessionOrder | null {
  const row = asRecord(raw);
  if (!row) return null;
  const orderId = asString(row.order_id);
  const orderNumber = asString(row.order_number);
  const status = asString(row.status);
  const paymentStatus = asString(row.payment_status);
  const total = asNumber(row.total);
  const createdAt = asString(row.created_at);
  if (!orderId || !orderNumber || !status || !paymentStatus || total === null || !createdAt) {
    return null;
  }
  return {
    orderId,
    orderNumber,
    status,
    paymentStatus,
    paymentMethod: asString(row.payment_method),
    paymentReference: asString(row.payment_reference),
    total,
    createdAt,
    orderKind: asString(row.order_kind),
    fulfillmentType: asString(row.fulfillment_type),
    activeManualPaymentConfirmationId: asString(row.active_manual_payment_confirmation_id),
  };
}

export function mapTableSessionAccount(raw: unknown): TableSessionAccount | null {
  const root = asRecord(raw);
  if (!root) return null;
  const sessionRaw = asRecord(root.session);
  const summaryRaw = asRecord(root.summary);
  if (!sessionRaw || !summaryRaw) return null;

  const sessionId = asString(sessionRaw.session_id);
  const tableId = asString(sessionRaw.table_id);
  const tableCode = asString(sessionRaw.table_code);
  const branchId = asString(sessionRaw.branch_id);
  const status = asSessionStatus(sessionRaw.status);
  const openedAt = asString(sessionRaw.opened_at);
  if (!sessionId || !tableId || !tableCode || !branchId || !status || !openedAt) return null;

  const summary: TableSessionAccountSummary = {
    orderCount: asNumber(summaryRaw.order_count) ?? 0,
    accountTotal: asNumber(summaryRaw.account_total) ?? 0,
    outstandingTotal: asNumber(summaryRaw.outstanding_total) ?? 0,
    paidCount: asNumber(summaryRaw.paid_count) ?? 0,
    pendingCount: asNumber(summaryRaw.pending_count) ?? 0,
  };

  const session: TableSession = {
    sessionId,
    tableId,
    tableCode,
    tableName: asString(sessionRaw.table_name),
    branchId,
    status,
    openedAt,
    closedAt: asString(sessionRaw.closed_at),
    openedBy: asString(sessionRaw.opened_by),
    closedBy: asString(sessionRaw.closed_by),
  };

  const orders = Array.isArray(root.orders)
    ? root.orders.map(mapTableSessionOrder).filter((item): item is TableSessionOrder => item !== null)
    : [];

  return { session, orders, summary };
}

function mapAllocation(raw: unknown): ManualPaymentAllocation | null {
  const row = asRecord(raw);
  if (!row) return null;
  const allocationId = asString(row.allocation_id);
  const orderId = asString(row.order_id);
  const orderNumber = asString(row.order_number);
  const allocatedAmount = asNumber(row.allocated_amount);
  const previousPaymentStatus = asString(row.previous_payment_status);
  if (!allocationId || !orderId || !orderNumber || allocatedAmount === null || !previousPaymentStatus) {
    return null;
  }
  return { allocationId, orderId, orderNumber, allocatedAmount, previousPaymentStatus };
}

function mapVoid(raw: unknown): ManualPaymentVoid | null {
  const row = asRecord(raw);
  if (!row) return null;
  const voidId = asString(row.void_id);
  const voidedBy = asString(row.voided_by);
  const voidedAt = asString(row.voided_at);
  const reason = asString(row.reason);
  if (!voidId || !voidedBy || !voidedAt || !reason) return null;
  return {
    voidId,
    voidedBy,
    voidedByName: asString(row.voided_by_name),
    voidedAt,
    reason,
  };
}

export function mapManualPaymentHistoryEntry(raw: unknown): ManualPaymentHistoryEntry | null {
  const row = asRecord(raw);
  if (!row) return null;
  const confirmationId = asString(row.confirmation_id);
  const targetType = asTargetType(row.target_type);
  const amount = asNumber(row.amount);
  const currency = asString(row.currency);
  const confirmationKind = asConfirmationKind(row.confirmation_kind, row.method);
  const confirmedBy = asString(row.confirmed_by);
  const confirmedAt = asString(row.confirmed_at);
  const status = asHistoryStatus(row.status);
  if (
    !confirmationId ||
    !targetType ||
    amount === null ||
    !currency ||
    !confirmationKind ||
    !confirmedBy ||
    !confirmedAt ||
    !status
  ) {
    return null;
  }
  return {
    confirmationId,
    targetType,
    targetOrderId: asString(row.target_order_id),
    targetTableSessionId: asString(row.target_table_session_id),
    amount,
    currency,
    confirmationKind,
    method: asString(row.method),
    paymentReference: asString(row.payment_reference),
    confirmedBy,
    confirmedByName: asString(row.confirmed_by_name),
    confirmedAt,
    status,
    allocations: Array.isArray(row.allocations)
      ? row.allocations.map(mapAllocation).filter((item): item is ManualPaymentAllocation => item !== null)
      : [],
    void: mapVoid(row.void),
  };
}

export function mapManualPaymentHistory(raw: unknown): ManualPaymentHistory {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(mapManualPaymentHistoryEntry)
    .filter((item): item is ManualPaymentHistoryEntry => item !== null);
}

export function mapResolvedTableQr(raw: unknown): ResolvedTableQrPublic | null {
  const row = asRecord(raw);
  if (!row) return null;
  const code = asString(row.code);
  const branchId = asString(row.branch_id);
  const tableId = asString(row.table_id);
  const sessionId = asString(row.session_id);
  const sessionStatus = asSessionStatus(row.session_status);
  if (!code || !branchId || !tableId || !sessionId || !sessionStatus) return null;
  return {
    code,
    name: asString(row.name),
    branchId,
    tableId,
    sessionId,
    sessionStatus,
  };
}

export function mapManualPaymentConfirmationResult(
  raw: unknown,
): ManualPaymentConfirmationResult | null {
  const row = asRecord(raw);
  if (!row) return null;
  const confirmationId = asString(row.confirmation_id) ?? asString(row.id);
  const amount = asNumber(row.amount) ?? asNumber(row.amount_snapshot);
  const replay = asBoolean(row.replay) ?? false;
  if (!confirmationId || amount === null) return null;
  const method = (asString(row.method) ?? asString(row.confirmation_kind) ?? "cash") as
    | ManualPaymentMethod
    | string;
  const targetType =
    asTargetType(row.target_type) ??
    (row.target_table_session_id
      ? "table_session"
      : row.target_order_id
        ? "order"
        : asSessionStatus(row.session_status)
          ? "table_session"
          : "order");
  return {
    confirmationId,
    replay,
    amount,
    method,
    paymentReference: asString(row.payment_reference),
    targetType,
    orderIds: Array.isArray(row.order_ids)
      ? row.order_ids.filter((id): id is string => typeof id === "string")
      : undefined,
    sessionId: asString(row.session_id) ?? asString(row.target_table_session_id) ?? undefined,
    sessionStatus: asSessionStatus(row.session_status) ?? undefined,
  };
}
