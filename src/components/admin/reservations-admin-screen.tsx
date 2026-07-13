"use client";

import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { branches } from "@/config/restaurant";
import { useMounted } from "@/hooks/use-mounted";
import { useReservationsStore } from "@/stores/reservations";

/** Reservas demo del navegador con cancelación desde el panel. */
export function ReservationsAdminScreen() {
  const { toast } = useToast();
  const mounted = useMounted();
  const reservations = useReservationsStore((state) => state.reservations);
  const cancelReservation = useReservationsStore((state) => state.cancelReservation);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Reservas</h1>
        <p className="mt-1 text-sm text-muted">
          Reservas de demostración creadas en este navegador. Con Supabase, aquí se gestionan las
          reservas reales de todas las sucursales.
        </p>
      </header>

      {!mounted ? (
        <div aria-busy="true" className="skeleton h-32 w-full rounded-card" />
      ) : reservations.length === 0 ? (
        <EmptyState
          title="Aún no hay reservas"
          description="Crea una reserva de prueba desde la sección Reservar de la tienda."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {reservations.map((reservation) => {
            const branch = branches.find((candidate) => candidate.id === reservation.branchId);
            return (
              <li
                key={reservation.id}
                className="rounded-card border border-border-soft bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-bold">
                    <CalendarClock aria-hidden className="size-5 text-lime" />
                    {reservation.customerName}
                  </p>
                  <Badge
                    variant={
                      reservation.status === "confirmed"
                        ? "success"
                        : reservation.status === "cancelled"
                          ? "error"
                          : "warning"
                    }
                  >
                    {reservation.status === "confirmed"
                      ? "Confirmada"
                      : reservation.status === "cancelled"
                        ? "Cancelada"
                        : "Pendiente"}
                  </Badge>
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {reservation.date} · {reservation.time} · {reservation.partySize}{" "}
                  {reservation.partySize === 1 ? "persona" : "personas"} · {branch?.name ?? "—"}
                </p>
                <p className="text-[13px] text-muted">
                  {reservation.phone} · {reservation.email}
                </p>
                {reservation.occasion ? (
                  <p className="mt-1 text-[13px] text-muted">Ocasión: {reservation.occasion}</p>
                ) : null}
                {reservation.notes ? (
                  <p className="mt-1 text-[13px] italic text-faint">“{reservation.notes}”</p>
                ) : null}
                {reservation.status !== "cancelled" ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      cancelReservation(reservation.id);
                      toast({ title: "Reserva cancelada", description: reservation.customerName });
                    }}
                  >
                    Cancelar reserva
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
