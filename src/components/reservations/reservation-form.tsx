"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { branches, restaurantConfig } from "@/config/restaurant";
import { reservationInputSchema, type ReservationInput } from "@/features/reservations/schema";
import { submitReservationRequest } from "@/features/reservations/submit";
import { track } from "@/lib/analytics";
import { useMounted } from "@/hooks/use-mounted";
import { getAvailableTimeSlots } from "@/lib/menu/opening-hours";
import { todayIso } from "@/lib/utils";
import { useReservationsStore } from "@/stores/reservations";
import type { Reservation } from "@/types/order";

const OCCASIONS = ["Cumpleaños", "Aniversario", "Negocios", "Celebración familiar", "Otra"] as const;

/**
 * Formulario de reservas validado en cliente (experiencia) y en servidor
 * (fuente de verdad): fecha dentro de la ventana, franja disponible según
 * horario de la sucursal, tamaño de grupo y datos de contacto.
 */
export function ReservationForm({
  onSuccess,
}: {
  onSuccess?: (reservation: Reservation) => void;
}) {
  const { toast } = useToast();
  const addReservation = useReservationsStore((state) => state.addReservation);
  const [serverError, setServerError] = useState<string | null>(null);
  const startTracked = useRef(false);

  const timezone = restaurantConfig.timezone;
  // La página se prerenderiza en build: todo lo derivado de "hoy" debe
  // resolverse tras el montaje para no divergir del HTML estático
  // (hydration mismatch #418 si pasan horas entre build y visita).
  const mounted = useMounted();
  const minDate = mounted ? todayIso(timezone) : "";
  const maxDate = useMemo(() => {
    if (!mounted) return "";
    const limit = new Date(
      Date.now() + restaurantConfig.reservations.maxAdvanceDays * 24 * 60 * 60 * 1000,
    );
    return todayIso(timezone, limit);
  }, [timezone, mounted]);

  const defaultBranch = branches.find((branch) => branch.reservationsEnabled) ?? branches[0];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReservationInput>({
    resolver: zodResolver(reservationInputSchema),
    mode: "onTouched",
    defaultValues: {
      branchId: defaultBranch?.id ?? "",
      date: "",
      time: "",
      partySize: 2,
      customerName: "",
      phone: "",
      email: "",
      occasion: "",
      notes: "",
      marketingConsent: false,
    },
  });

  const branchId = watch("branchId");
  const date = watch("date");
  const time = watch("time");

  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? defaultBranch;

  const slots = useMemo(() => {
    if (!selectedBranch || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return [];
    return getAvailableTimeSlots(selectedBranch, date, {
      intervalMinutes: restaurantConfig.reservations.slotIntervalMinutes,
      minLeadMinutes: restaurantConfig.reservations.minLeadMinutes,
    });
  }, [selectedBranch, date]);

  // La fecha por defecto (hoy) se fija tras el montaje (ver nota arriba).
  useEffect(() => {
    if (mounted && minDate && !getValues("date")) {
      setValue("date", minDate);
    }
  }, [mounted, minDate, getValues, setValue]);

  // Si cambia la fecha/sucursal y la hora elegida ya no existe, se limpia.
  useEffect(() => {
    if (time && !slots.includes(time)) {
      setValue("time", "");
    }
  }, [slots, time, setValue]);

  const onFirstInteraction = () => {
    if (!startTracked.current) {
      startTracked.current = true;
      track("reservation_start");
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await submitReservationRequest({
      ...values,
      occasion: values.occasion?.trim() ? values.occasion.trim() : undefined,
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
    });

    if (!result.ok) {
      setServerError(result.error);
      toast({ title: "No pudimos crear la reserva", description: result.error, variant: "error" });
      return;
    }

    addReservation(result.reservation);
    track("reservation_complete", { branch: result.reservation.branchId });
    toast({
      title: "¡Reserva confirmada!",
      description: `${result.reservation.date} a las ${result.reservation.time}`,
      variant: "success",
    });
    reset();
    onSuccess?.(result.reservation);
  });

  const reservableBranches = branches.filter(
    (branch) => branch.reservationsEnabled && branch.status === "active",
  );

  return (
    <form
      aria-label="Formulario de reserva"
      className="flex flex-col gap-4"
      onSubmit={onSubmit}
      onFocusCapture={onFirstInteraction}
      noValidate
    >
      <SelectField label="Sucursal" error={errors.branchId?.message} {...register("branchId")}>
        {reservableBranches.map((branch) => (
          <option key={branch.id} value={branch.id} className="bg-background-secondary">
            {branch.name} — {branch.address}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
        <TextField
          label="Fecha"
          type="date"
          min={minDate}
          max={maxDate}
          error={errors.date?.message}
          {...register("date")}
        />
        <SelectField
          label="Hora"
          error={errors.time?.message}
          hint={date && slots.length === 0 ? "La sucursal no abre ese día." : undefined}
          disabled={slots.length === 0}
          {...register("time")}
        >
          <option value="" className="bg-background-secondary">
            {date && slots.length === 0 ? "Sin horarios" : "Selecciona una hora"}
          </option>
          {slots.map((slot) => (
            <option key={slot} value={slot} className="bg-background-secondary">
              {slot}
            </option>
          ))}
        </SelectField>
      </div>

      <SelectField
        label="Número de personas"
        error={errors.partySize?.message}
        {...register("partySize", { valueAsNumber: true })}
      >
        {Array.from(
          { length: restaurantConfig.reservations.maxPartySize },
          (_, index) => index + 1,
        ).map((size) => (
          <option key={size} value={size} className="bg-background-secondary">
            {size} {size === 1 ? "persona" : "personas"}
          </option>
        ))}
      </SelectField>

      <TextField
        label="Nombre completo"
        autoComplete="name"
        placeholder="Ej. Ana María Pérez"
        error={errors.customerName?.message}
        {...register("customerName")}
      />
      <TextField
        label="Teléfono"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="Ej. +57 300 123 4567"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <TextField
        label="Correo electrónico"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="tucorreo@ejemplo.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <SelectField
        label="Ocasión (opcional)"
        error={errors.occasion?.message}
        {...register("occasion")}
      >
        <option value="" className="bg-background-secondary">
          Sin ocasión especial
        </option>
        {OCCASIONS.map((occasion) => (
          <option key={occasion} value={occasion} className="bg-background-secondary">
            {occasion}
          </option>
        ))}
      </SelectField>

      <TextAreaField
        label="Notas (opcional)"
        placeholder="Alergias, silla para bebé, preferencia de mesa…"
        error={errors.notes?.message}
        {...register("notes")}
      />

      <label className="flex items-start gap-3 rounded-2xl border border-border-soft bg-white/4 px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-[#fdf501]"
          {...register("marketingConsent")}
        />
        <span className="text-[13px] leading-relaxed text-muted">
          Quiero recibir promociones y novedades por correo. <strong>Opcional</strong>; puedes
          darte de baja cuando quieras.
        </span>
      </label>

      {serverError ? (
        <p role="alert" className="rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-[13px] font-semibold text-error">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" fullWidth loading={isSubmitting}>
        <CalendarCheck aria-hidden className="size-5" />
        {isSubmitting ? "Reservando…" : "Confirmar reserva"}
      </Button>
    </form>
  );
}
