"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Reservation } from "@/types/order";

/** Reservas demo del navegador; con Supabase se persisten en BD además. */
interface ReservationsState {
  reservations: Reservation[];
  addReservation: (reservation: Reservation) => void;
  cancelReservation: (id: string) => void;
}

const MAX_STORED = 20;

export const useReservationsStore = create<ReservationsState>()(
  persist(
    (set) => ({
      reservations: [],
      addReservation: (reservation) => {
        set((state) => {
          const withoutDuplicate = state.reservations.filter(
            (existing) => existing.id !== reservation.id,
          );
          return { reservations: [reservation, ...withoutDuplicate].slice(0, MAX_STORED) };
        });
      },
      cancelReservation: (id) => {
        set((state) => ({
          reservations: state.reservations.map((reservation) =>
            reservation.id === id ? { ...reservation, status: "cancelled" } : reservation,
          ),
        }));
      },
    }),
    {
      name: "rb-reservations",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
