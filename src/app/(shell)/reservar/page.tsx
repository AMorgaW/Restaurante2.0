import type { Metadata } from "next";
import { ReservationsScreen } from "@/components/reservations/reservations-screen";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Reservar mesa",
  description:
    "Reserva tu mesa en línea: elige sucursal, fecha, hora y número de personas.",
  alternates: { canonical: `${siteUrl}/reservar` },
};

export default function ReservationsPage() {
  return <ReservationsScreen />;
}
