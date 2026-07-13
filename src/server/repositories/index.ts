import { getResolvedDataMode } from "@/lib/env/server";
import {
  LocalMenuRepository,
  LocalOrderRepository,
  LocalReservationRepository,
} from "./local";
import {
  SupabaseMenuRepository,
  SupabaseOrderRepository,
  SupabaseReservationRepository,
} from "./supabase";
import type { MenuRepository, OrderRepository, ReservationRepository } from "./types";

/** Selección de proveedor de datos según DATA_MODE (con degradación a local). */

export function getMenuRepository(): MenuRepository {
  return getResolvedDataMode() === "supabase"
    ? new SupabaseMenuRepository()
    : new LocalMenuRepository();
}

export function getOrderRepository(): OrderRepository {
  return getResolvedDataMode() === "supabase"
    ? new SupabaseOrderRepository()
    : new LocalOrderRepository();
}

export function getReservationRepository(): ReservationRepository {
  return getResolvedDataMode() === "supabase"
    ? new SupabaseReservationRepository()
    : new LocalReservationRepository();
}
