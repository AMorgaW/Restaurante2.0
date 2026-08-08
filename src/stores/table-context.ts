"use client";

import { create } from "zustand";

/**
 * Contexto temporal de mesa (QR).
 * sessionStorage: vive mientras la pestaña; no localStorage indefinido.
 * Nunca loggear el token.
 */
export interface TableContextState {
  tableQrToken: string | null;
  tableCode: string | null;
  tableName: string | null;
  branchConfigId: string | null;
  setFromResolved: (input: {
    tableQrToken: string;
    tableCode: string;
    tableName: string | null;
    branchConfigId: string;
  }) => void;
  clear: () => void;
  hydrateFromSession: () => void;
}

const STORAGE_KEY = "rb-table-context";

type Persisted = {
  tableQrToken: string;
  tableCode: string;
  tableName: string | null;
  branchConfigId: string;
};

function readSession(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (
      typeof parsed.tableQrToken !== "string" ||
      typeof parsed.tableCode !== "string" ||
      typeof parsed.branchConfigId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(value: Persisted | null) {
  if (typeof window === "undefined") return;
  if (!value) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export const useTableContextStore = create<TableContextState>((set) => ({
  tableQrToken: null,
  tableCode: null,
  tableName: null,
  branchConfigId: null,

  setFromResolved: (input) => {
    writeSession({
      tableQrToken: input.tableQrToken,
      tableCode: input.tableCode,
      tableName: input.tableName,
      branchConfigId: input.branchConfigId,
    });
    set({
      tableQrToken: input.tableQrToken,
      tableCode: input.tableCode,
      tableName: input.tableName,
      branchConfigId: input.branchConfigId,
    });
  },

  clear: () => {
    writeSession(null);
    set({
      tableQrToken: null,
      tableCode: null,
      tableName: null,
      branchConfigId: null,
    });
  },

  hydrateFromSession: () => {
    const persisted = readSession();
    if (!persisted) return;
    set({
      tableQrToken: persisted.tableQrToken,
      tableCode: persisted.tableCode,
      tableName: persisted.tableName,
      branchConfigId: persisted.branchConfigId,
    });
  },
}));
