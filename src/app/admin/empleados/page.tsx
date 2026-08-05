import type { Metadata } from "next";
import { StaffScreen } from "@/components/admin/staff-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";

export const metadata: Metadata = { title: "Empleados", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await authorizeAdminSection("employees");
  return <StaffScreen />;
}
