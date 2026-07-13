"use client";

import { CalendarX2, Clock, MapPin, Users } from "lucide-react";
import { useState } from "react";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { branches } from "@/config/restaurant";
import { useMounted } from "@/hooks/use-mounted";
import { useReservationsStore } from "@/stores/reservations";

const STATUS_BADGES: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" }
> = {
  confirmed: { label: "Confirmada", variant: "success" },
  pending: { label: "Pendiente", variant: "warning" },
  cancelled: { label: "Cancelada", variant: "error" },
};

/** Pantalla de reservas: formulario + listado local con cancelación. */
export function ReservationsScreen() {
  const { toast } = useToast();
  const mounted = useMounted();
  const reservations = useReservationsStore((state) => state.reservations);
  const cancelReservation = useReservationsStore((state) => state.cancelReservation);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const pendingCancel = reservations.find((reservation) => reservation.id === cancelId);

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 md:px-0">
      <div>
        <h1 className="text-screen-title font-extrabold tracking-tight">Reserva tu mesa</h1>
        <p className="mt-1 text-sm text-muted">
          Elige sucursal, fecha y hora; confirmamos al instante en modo demostración.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.2fr_1fr] md:items-start">
        <section
          aria-label="Nueva reserva"
          className="rounded-card border border-border-soft bg-surface p-4 xs:p-5"
        >
          <ReservationForm />
        </section>

        <section aria-labelledby="mis-reservas-titulo" className="flex flex-col gap-3">
          <h2 id="mis-reservas-titulo" className="text-lg font-bold">
            Tus reservas
          </h2>
          {!mounted ? (
            <div aria-busy="true" className="skeleton h-28 w-full rounded-card" />
          ) : reservations.length === 0 ? (
            <p className="rounded-card border border-border-soft bg-white/4 px-4 py-6 text-center text-sm text-muted">
              Aún no tienes reservas en este navegador.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {reservations.map((reservation) => {
                const branch = branches.find(
                  (candidate) => candidate.id === reservation.branchId,
                );
                const badge = STATUS_BADGES[reservation.status] ?? STATUS_BADGES.pending;
                return (
                  <li
                    key={reservation.id}
                    className="rounded-card border border-border-soft bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold">{reservation.customerName}</p>
                      {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock aria-hidden className="size-4" />
                        {reservation.date} · {reservation.time}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users aria-hidden className="size-4" />
                        {reservation.partySize}{" "}
                        {reservation.partySize === 1 ? "persona" : "personas"}
                      </span>
                      {branch ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin aria-hidden className="size-4" />
                          {branch.name}
                        </span>
                      ) : null}
                    </div>
                    {reservation.status !== "cancelled" ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-3"
                        onClick={() => setCancelId(reservation.id)}
                      >
                        <CalendarX2 aria-hidden className="size-4" />
                        Cancelar reserva
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[12px] text-faint">
            Las reservas de demostración se guardan en este navegador. En producción se sincronizan
            con la base de datos del restaurante.
          </p>
        </section>
      </div>

      <Dialog
        open={cancelId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelId(null);
        }}
        title="¿Cancelar la reserva?"
        description={
          pendingCancel
            ? `Reserva del ${pendingCancel.date} a las ${pendingCancel.time} para ${pendingCancel.partySize} ${pendingCancel.partySize === 1 ? "persona" : "personas"}.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="destructive"
              size="md"
              fullWidth
              onClick={() => {
                if (cancelId) {
                  cancelReservation(cancelId);
                  toast({ title: "Reserva cancelada" });
                }
                setCancelId(null);
              }}
            >
              Sí, cancelar
            </Button>
            <Button variant="secondary" size="md" fullWidth onClick={() => setCancelId(null)}>
              Mantener reserva
            </Button>
          </>
        }
      />
    </div>
  );
}
