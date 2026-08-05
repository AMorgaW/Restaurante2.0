import type { AdminRole } from "@/lib/admin/authorization";
import type { Order, OrderStatus } from "@/types/order";

export interface EmployeeDemoProfile {
  id: string;
  name: string;
  role: Exclude<AdminRole, "owner" | "admin">;
  branchId: string;
  branchName: string;
}

export interface EmployeeShift {
  id: string;
  profileId: string;
  branchId: string;
  startedAt: string;
  endedAt?: string;
  status: "active" | "finished";
  summary: string;
}

export type IncidentCategory = "pedido" | "inventario" | "servicio" | "sistema";
export type IncidentPriority = "baja" | "media" | "alta";
export type IncidentStatus = "abierta" | "en revisión" | "resuelta";

export interface EmployeeIncident {
  id: string;
  category: IncidentCategory;
  orderId?: string;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  createdAt: string;
}

export interface EmployeeActivity {
  id: string;
  action: string;
  orderId?: string;
  createdAt: string;
  result: "correcto" | "pendiente" | "rechazado";
}

export interface EmployeeMetrics {
  newOrders: number;
  preparing: number;
  ready: number;
  delivered: number;
  deliveries: number;
  localOrders: number;
}

export type EmployeeOrderFilter = "all" | "new" | "preparing" | "ready" | "delivery" | "local";

export interface EmployeeOrderView {
  order: Order;
  elapsedMinutes: number;
  channelLabel: "Domicilio" | "Mostrador";
  nextStatus?: OrderStatus;
}
