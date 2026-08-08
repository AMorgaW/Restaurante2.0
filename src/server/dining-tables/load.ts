import "server-only";

import { branches } from "@/config/restaurant";
import { getResolvedDataMode } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getManualPaymentHistoryForStaff,
  getTableSessionAccountForStaff,
  listDiningTablesForStaff,
} from "@/server/dining-tables/service";
import type {
  DiningTableListItem,
  ManualPaymentHistory,
  TableSessionAccount,
} from "@/types/dining-tables";

async function mapBranchUuidToConfigId(branchUuid: string): Promise<string> {
  try {
    const client = await createServerSupabaseClient();
    const { data } = await client.from("branches").select("id, slug").eq("id", branchUuid).maybeSingle();
    const row = data as { id: string; slug: string } | null;
    if (row?.slug) {
      const configured = branches.find((branch) => branch.slug === row.slug);
      if (configured) return configured.id;
    }
  } catch {
    // fall through
  }
  return branchUuid;
}

export async function loadDiningTablesForUi(options?: {
  includeInactive?: boolean;
  branchConfigId?: string | null;
}): Promise<{ tables: DiningTableListItem[]; error: string | null }> {
  try {
    let branchUuid: string | null = null;
    if (options?.branchConfigId && getResolvedDataMode() === "supabase") {
      const configured = branches.find((branch) => branch.id === options.branchConfigId);
      if (configured) {
        const client = await createServerSupabaseClient();
        const { data } = await client
          .from("branches")
          .select("id")
          .eq("slug", configured.slug)
          .eq("status", "active")
          .maybeSingle();
        const row = data as { id: string } | null;
        branchUuid = row?.id ?? null;
      }
    }
    const tables = await listDiningTablesForStaff({
      branchId: branchUuid,
      includeInactive: options?.includeInactive,
    });
    return { tables, error: null };
  } catch {
    return { tables: [], error: "No se pudieron cargar las mesas." };
  }
}

export async function loadTableSessionAccountForUi(
  sessionId: string,
): Promise<{ account: TableSessionAccount | null; error: string | null }> {
  try {
    const account = await getTableSessionAccountForStaff(sessionId);
    return { account, error: null };
  } catch {
    return { account: null, error: "No se pudo cargar la cuenta de la mesa." };
  }
}

export async function loadManualPaymentHistoryForUi(input: {
  targetType: "order" | "table_session";
  targetId: string;
}): Promise<{ history: ManualPaymentHistory; error: string | null }> {
  try {
    const history = await getManualPaymentHistoryForStaff(input);
    return { history, error: null };
  } catch {
    return { history: [], error: "No se pudo cargar el historial de cobros." };
  }
}

export async function resolveBranchConfigIdFromUuid(branchUuid: string): Promise<string> {
  return mapBranchUuidToConfigId(branchUuid);
}
