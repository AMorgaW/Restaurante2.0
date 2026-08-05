import { branches } from "@/config/restaurant";
import type { StaffMember } from "@/lib/staff/types";

const branchName = (id: string) => branches.find((branch) => branch.id === id)?.name ?? id;

export const DEMO_STAFF_MEMBERS: StaffMember[] = [
  { id: "staff-owner", name: "Juan Pérez", email: "jefe.demo@example.test", role: "owner", branchIds: branches.map((branch) => branch.id), branchNames: branches.map((branch) => branch.name), status: "active", joinedAt: "2025-01-01", lastAccessAt: "2026-08-04T08:00:00-05:00", demoOnly: true },
  { id: "staff-admin", name: "Daniela Torres", email: "admin.demo@example.test", role: "admin", branchIds: ["branch-centro"], branchNames: [branchName("branch-centro")], status: "active", joinedAt: "2025-02-10", lastAccessAt: "2026-08-04T08:15:00-05:00", demoOnly: true },
  { id: "demo-manager", name: "Laura Gómez", email: "laura.demo@example.test", role: "manager", branchIds: ["branch-centro"], branchNames: [branchName("branch-centro")], status: "active", joinedAt: "2025-03-12", lastAccessAt: "2026-08-04T08:20:00-05:00", demoOnly: true },
  { id: "demo-kitchen", name: "Juan Pérez Cocina", email: "cocina.demo@example.test", role: "kitchen", branchIds: ["branch-centro"], branchNames: [branchName("branch-centro")], status: "active", joinedAt: "2025-04-03", lastAccessAt: "2026-08-04T08:25:00-05:00", demoOnly: true },
  { id: "demo-cashier", name: "Camila Ríos", email: "camila.demo@example.test", role: "cashier", branchIds: ["branch-centro"], branchNames: [branchName("branch-centro")], status: "active", joinedAt: "2025-04-18", lastAccessAt: "2026-08-04T08:30:00-05:00", demoOnly: true },
  { id: "demo-editor", name: "Mateo Silva", email: "mateo.demo@example.test", role: "editor", branchIds: ["branch-centro"], branchNames: [branchName("branch-centro")], status: "active", joinedAt: "2025-05-06", lastAccessAt: "2026-08-04T08:35:00-05:00", demoOnly: true },
  { id: "demo-support", name: "Sofía López", email: "sofia.demo@example.test", role: "support", branchIds: ["branch-centro"], branchNames: [branchName("branch-centro")], status: "active", joinedAt: "2025-05-21", lastAccessAt: "2026-08-04T08:40:00-05:00", demoOnly: true },
];
