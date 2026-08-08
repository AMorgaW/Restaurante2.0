/** Dominio tipado de mesas, sesiones y cobros manuales (11B-6). */

export type TableOperationalState = "inactive" | "free" | "open_account";

export type TableSessionStatus = "open" | "closed";

export type ManualPaymentMethod = "cash" | "bank_transfer" | "zero_balance";

export type ManualConfirmationKind = "cash" | "bank_transfer" | "zero_balance";

export type ManualPaymentHistoryTargetType = "order" | "table_session";

export type ManualPaymentHistoryStatus = "active" | "voided";

export interface DiningTable {
  id: string;
  branchId: string;
  code: string;
  name: string | null;
  isActive: boolean;
}

/** Resultado puntual de create/rotate: incluye raw QR una sola vez. */
export interface DiningTableQrCredential {
  tableId: string;
  branchId?: string;
  code?: string;
  qrToken: string;
}

export interface DiningTableListItem {
  tableId: string;
  branchId: string;
  code: string;
  name: string | null;
  isActive: boolean;
  openSessionId: string | null;
  sessionOpenedAt: string | null;
  orderCount: number;
  accountTotal: number;
  outstandingTotal: number;
  operationalStatus: TableOperationalState;
}

export interface TableSession {
  sessionId: string;
  tableId: string;
  tableCode: string;
  tableName: string | null;
  branchId: string;
  status: TableSessionStatus;
  openedAt: string;
  closedAt: string | null;
  openedBy: string | null;
  closedBy: string | null;
}

export interface TableSessionOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  total: number;
  createdAt: string;
  orderKind: string | null;
  fulfillmentType: string | null;
  activeManualPaymentConfirmationId: string | null;
}

export interface TableSessionAccountSummary {
  orderCount: number;
  accountTotal: number;
  outstandingTotal: number;
  paidCount: number;
  pendingCount: number;
}

export interface TableSessionAccount {
  session: TableSession;
  orders: TableSessionOrder[];
  summary: TableSessionAccountSummary;
}

/** Información pública mínima tras resolve_table_qr (sin UUIDs internos en UI). */
export interface ResolvedTableQrPublic {
  code: string;
  name: string | null;
  /** UUID de sucursal PostgreSQL; se mapea a config en servidor. */
  branchId: string;
  /** Solo para staff interno / binding; no mostrar al cliente. */
  tableId: string;
  sessionId: string;
  sessionStatus: TableSessionStatus;
}

export interface ManualPaymentAllocation {
  allocationId: string;
  orderId: string;
  orderNumber: string;
  allocatedAmount: number;
  previousPaymentStatus: string;
}

export interface ManualPaymentVoid {
  voidId: string;
  voidedBy: string;
  voidedByName: string | null;
  voidedAt: string;
  reason: string;
}

export interface ManualPaymentHistoryEntry {
  confirmationId: string;
  targetType: ManualPaymentHistoryTargetType;
  targetOrderId: string | null;
  targetTableSessionId: string | null;
  amount: number;
  currency: string;
  confirmationKind: ManualConfirmationKind;
  method: string | null;
  paymentReference: string | null;
  confirmedBy: string;
  confirmedByName: string | null;
  confirmedAt: string;
  status: ManualPaymentHistoryStatus;
  allocations: ManualPaymentAllocation[];
  void: ManualPaymentVoid | null;
}

export type ManualPaymentHistory = ManualPaymentHistoryEntry[];

export interface ManualPaymentConfirmationResult {
  confirmationId: string;
  replay: boolean;
  amount: number;
  method: ManualPaymentMethod | string;
  paymentReference: string | null;
  targetType: ManualPaymentHistoryTargetType;
  orderIds?: string[];
  sessionId?: string;
  sessionStatus?: TableSessionStatus;
}
