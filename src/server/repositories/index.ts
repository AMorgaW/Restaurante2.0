import { getResolvedDataMode } from "@/lib/env/server";
import {
  LocalMenuRepository,
  LocalOrderRepository,
} from "./local";
import {
  SupabaseMenuRepository,
  SupabaseOrderRepository,
} from "./supabase";
import type { MenuRepository, OrderRepository } from "./types";

/** Selección estricta por DATA_MODE; una configuración inválida falla antes de elegir repositorio. */

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
