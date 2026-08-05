import type { EmployeeActivity, EmployeeDemoProfile, EmployeeIncident, EmployeeShift } from "@/lib/employee/types";

export const DEMO_EMPLOYEE_PROFILES: EmployeeDemoProfile[] = [
  { id: "demo-manager", name: "Laura Gómez", role: "manager", branchId: "branch-centro", branchName: "Casa Brasa Centro" },
  { id: "demo-kitchen", name: "Juan Pérez", role: "kitchen", branchId: "branch-centro", branchName: "Casa Brasa Centro" },
  { id: "demo-cashier", name: "Camila Ríos", role: "cashier", branchId: "branch-centro", branchName: "Casa Brasa Centro" },
  { id: "demo-editor", name: "Mateo Silva", role: "editor", branchId: "branch-centro", branchName: "Casa Brasa Centro" },
  { id: "demo-support", name: "Sofía López", role: "support", branchId: "branch-centro", branchName: "Casa Brasa Centro" },
];

export const DEMO_EMPLOYEE_SHIFTS: EmployeeShift[] = DEMO_EMPLOYEE_PROFILES.map((profile) => ({
  id: `shift-${profile.role}`,
  profileId: profile.id,
  branchId: profile.branchId,
  startedAt: "2026-08-04T07:30:00-05:00",
  status: "active",
  summary: "Turno demo activo; las acciones se conservan solo en este navegador.",
}));

export const DEMO_EMPLOYEE_ACTIVITIES: EmployeeActivity[] = [
  { id: "activity-demo-1", action: "Revisión de cola iniciada", createdAt: "2026-08-04T08:05:00-05:00", result: "correcto" },
  { id: "activity-demo-2", action: "Disponibilidad de inventario consultada", createdAt: "2026-08-04T08:20:00-05:00", result: "correcto" },
];

export const DEMO_EMPLOYEE_INCIDENTS: EmployeeIncident[] = [
  { id: "incident-demo-1", category: "servicio", description: "Demostración: revisar tiempos de mostrador.", priority: "media", status: "abierta", createdAt: "2026-08-04T09:00:00-05:00" },
];
